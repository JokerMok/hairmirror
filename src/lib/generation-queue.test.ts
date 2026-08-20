import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hashPassword } from "./auth";
import { HAIRSTYLES } from "./catalog";
import {
  closeDatabaseForTest,
  db,
  getAuthUserById,
  RUNNINGHUB_INTERNATIONAL_ENDPOINT,
  type AuthUser,
} from "./database";
import {
  claimNextGenerationJob,
  enqueuePersistentGeneration,
  processNextGenerationJob,
  recoverStaleGenerationJobs,
  requestGenerationCancellation,
} from "./generation-queue";
import { encryptSecret } from "./secret-vault";
import { persistSourceImage } from "./source-storage";
import { getTaskInternal } from "./task-store";
import { DEFAULT_DESIGN_PREFERENCES, type StoredDesignTask } from "./types";

let directory = "";
let sequence = 0;
const queueUserId = "00000000-0000-4000-8000-000000000401";
let queueUser: AuthUser;
function task(): StoredDesignTask {
  return {
    id: crypto.randomUUID(),
    ownerSessionId: "owner",
    userId: queueUserId,
    status: "queued",
    createdAt: new Date().toISOString(),
    generationMode: "demo-fixed",
    preferences: {
      ...DEFAULT_DESIGN_PREFERENCES,
      audience: "neutral",
      currentLength: "short",
      targetLength: "short",
      goal: "fresh",
      chemical: false,
      dailyMinutes: 5,
    },
    variants: HAIRSTYLES.slice(0, 3).map((template) => ({
      id: crypto.randomUUID(),
      template,
      reason: `test-${(sequence += 1)}`,
    })),
  };
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "hair-queue-"));
  process.env.SQLITE_PATH = join(directory, "test.db");
  process.env.GENERATED_ASSETS_DIR = join(directory, "generated");
  process.env.SOURCE_UPLOADS_DIR = join(directory, "uploads");
  process.env.MODEL_SECRET_KEY = Buffer.alloc(32, 1).toString("base64");
  db()
    .prepare(
      "INSERT INTO users(id,phone,email,name,password_hash,role,status,created_at) VALUES(?,?,?,?,?,'personal','active',?)",
    )
    .run(
      queueUserId,
      `email-${queueUserId}`,
      "queue@example.com",
      "Queue User",
      hashPassword("password123"),
      new Date().toISOString(),
    );
  queueUser = getAuthUserById(queueUserId)!;
});
afterEach(() => {
  vi.unstubAllGlobals();
  closeDatabaseForTest();
  for (const key of [
    "SQLITE_PATH",
    "GENERATED_ASSETS_DIR",
    "SOURCE_UPLOADS_DIR",
    "MODEL_SECRET_KEY",
    "JOB_STALE_MS",
    "GENERATION_GLOBAL_DAILY_COST_LIMIT_MICROS",
  ])
    delete process.env[key];
  rmSync(directory, { recursive: true, force: true });
});

describe("persistent generation queue", () => {
  it("does not silently accept work when no model is active", () => {
    db().prepare("UPDATE model_configs SET enabled=0").run();
    expect(() =>
      enqueuePersistentGeneration({
        task: task(),
        user: queueUser,
        ownerKey: `user:${queueUserId}`,
        idempotencyKey: "request-no-model",
        sourceImagePath: null,
        sourceExpiresAt: null,
      }),
    ).toThrow("NO_ACTIVE_MODEL");
    expect(
      (db().prepare("SELECT COUNT(*) AS count FROM generation_jobs").get() as { count: number }).count,
    ).toBe(0);
  });

  it("rejects anonymous work before creating a task", () => {
    expect(() =>
      enqueuePersistentGeneration({
        task: task(),
        user: null,
        ownerKey: "session:anonymous",
        idempotencyKey: "anonymous-request",
        sourceImagePath: null,
        sourceExpiresAt: null,
      }),
    ).toThrow("AUTH_REQUIRED");
    expect(
      (
        db().prepare("SELECT COUNT(*) AS count FROM generation_jobs").get() as {
          count: number;
        }
      ).count,
    ).toBe(0);
  });

  it("opens the global cost fuse before accepting new work", () => {
    process.env.GENERATION_GLOBAL_DAILY_COST_LIMIT_MICROS = "1";
    const item = task();
    expect(() =>
      enqueuePersistentGeneration({
        task: item,
        user: queueUser,
        ownerKey: `user:${queueUserId}`,
        idempotencyKey: "request-fuse",
        sourceImagePath: null,
        sourceExpiresAt: null,
      }),
    ).toThrow("COST_FUSE_OPEN");
    expect(
      (
        db().prepare("SELECT COUNT(*) AS count FROM generation_jobs").get() as {
          count: number;
        }
      ).count,
    ).toBe(0);
  });

  it("deduplicates enqueue and completes exactly once", async () => {
    const first = task();
    const queued = enqueuePersistentGeneration({
      task: first,
      user: queueUser,
      ownerKey: `user:${queueUserId}`,
      idempotencyKey: "request-0001",
      sourceImagePath: null,
      sourceExpiresAt: null,
    });
    const duplicate = enqueuePersistentGeneration({
      task: task(),
      user: queueUser,
      ownerKey: `user:${queueUserId}`,
      idempotencyKey: "request-0001",
      sourceImagePath: null,
      sourceExpiresAt: null,
    });
    expect(duplicate).toMatchObject({
      taskId: queued.taskId,
      jobId: queued.jobId,
      duplicate: true,
    });
    expect(
      (
        db().prepare("SELECT COUNT(*) AS count FROM generation_jobs").get() as {
          count: number;
        }
      ).count,
    ).toBe(1);
    expect(await processNextGenerationJob()).toMatchObject({
      status: "completed",
      jobId: queued.jobId,
    });
    expect(getTaskInternal(first.id)?.status).toBe("completed");
    expect(
      (
        db()
          .prepare(
            "SELECT COUNT(*) AS count FROM usage_records WHERE task_id=?",
          )
          .get(first.id) as { count: number }
      ).count,
    ).toBe(1);
    expect(await processNextGenerationJob()).toEqual({ status: "idle" });
    expect(() =>
      enqueuePersistentGeneration({
        task: task(),
        user: queueUser,
        ownerKey: `user:${queueUserId}`,
        idempotencyKey: "request-after-free-trial",
        sourceImagePath: null,
        sourceExpiresAt: null,
      }),
    ).toThrow("ACCESS_REQUIRED");
  });

  it("cancels a queued job and releases it from execution", async () => {
    const item = task();
    enqueuePersistentGeneration({
      task: item,
      user: queueUser,
      ownerKey: `user:${queueUserId}`,
      idempotencyKey: "request-0002",
      sourceImagePath: null,
      sourceExpiresAt: null,
    });
    expect(requestGenerationCancellation(item.id)).toEqual({
      ok: true,
      status: "cancelled",
    });
    expect(getTaskInternal(item.id)?.status).toBe("cancelled");
    expect(await processNextGenerationJob()).toEqual({ status: "idle" });
    expect(() =>
      enqueuePersistentGeneration({
        task: task(),
        user: queueUser,
        ownerKey: `user:${queueUserId}`,
        idempotencyKey: "request-after-cancel",
        sourceImagePath: null,
        sourceExpiresAt: null,
      }),
    ).not.toThrow();
  });

  it("recovers a stale processing job back to the queue", () => {
    process.env.JOB_STALE_MS = "1000";
    const item = task();
    enqueuePersistentGeneration({
      task: item,
      user: queueUser,
      ownerKey: `user:${queueUserId}`,
      idempotencyKey: "request-0003",
      sourceImagePath: null,
      sourceExpiresAt: null,
    });
    const now = Date.now() + 100;
    expect(claimNextGenerationJob(now)).not.toBeNull();
    expect(recoverStaleGenerationJobs(now + 1001)).toEqual({
      found: 1,
      requeued: 1,
      failed: 0,
      cancelled: 0,
    });
    expect(
      (
        db()
          .prepare("SELECT status FROM generation_jobs WHERE task_id=?")
          .get(item.id) as { status: string }
      ).status,
    ).toBe("queued");
  });

  it("schedules retry for a transient provider error and keeps the temporary source", async () => {
    const encrypted = encryptSecret("test-key");
    db()
      .prepare(
        "UPDATE model_configs SET provider='runninghub',model='test',endpoint='https://provider.example/generate',encrypted_api_key=? WHERE id='demo-fixed'",
      )
      .run(encrypted);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 500 })),
    );
    const item = task();
    const source = persistSourceImage(
      "data:image/png;base64,iVBORw0KGgo=",
      item.id,
    );
    enqueuePersistentGeneration({
      task: item,
      user: queueUser,
      ownerKey: `user:${queueUserId}`,
      idempotencyKey: "request-0004",
      sourceImagePath: source.path,
      sourceExpiresAt: source.expiresAt,
    });
    expect(await processNextGenerationJob(Date.now())).toMatchObject({
      status: "retrying",
      code: "RUNNINGHUB_HTTP_500",
    });
    const row = db()
      .prepare(
        "SELECT j.status,j.attempts,p.source_image_path FROM generation_jobs j JOIN generation_job_payloads p ON p.job_id=j.id WHERE j.task_id=?",
      )
      .get(item.id) as {
      status: string;
      attempts: number;
      source_image_path: string;
    };
    expect(row.status).toBe("queued");
    expect(row.attempts).toBe(1);
    expect(row.source_image_path).toBe(source.path);
  });

  it("stores provider error code and cleaned message for operations review", async () => {
    const encrypted = encryptSecret("test-key");
    db()
      .prepare(
        "UPDATE model_configs SET provider='runninghub',model='test',endpoint=?,encrypted_api_key=? WHERE id='demo-fixed'",
      )
      .run(RUNNINGHUB_INTERNATIONAL_ENDPOINT, encrypted);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        if (String(input).endsWith("/openapi/v2/query"))
          return Response.json({
            taskId: "rh-operations-error",
            status: "FAILED",
            errorCode: "40310",
            errorMessage: "供应商错误\n  额度不足  ",
          });
        return Response.json({
          taskId: "rh-operations-error",
          status: "RUNNING",
        });
      }),
    );
    const item = task();
    const source = persistSourceImage(
      "data:image/png;base64,iVBORw0KGgo=",
      item.id,
    );
    enqueuePersistentGeneration({
      task: item,
      user: queueUser,
      ownerKey: `user:${queueUserId}`,
      idempotencyKey: "request-provider-message",
      sourceImagePath: source.path,
      sourceExpiresAt: source.expiresAt,
    });

    const baseNow = Date.now();
    await processNextGenerationJob(baseNow);
    await processNextGenerationJob(baseNow + 100_000);
    await processNextGenerationJob(baseNow + 200_000);

    const row = db()
      .prepare(
        "SELECT j.status,j.error_code,p.last_error FROM generation_jobs j JOIN generation_job_payloads p ON p.job_id=j.id WHERE j.task_id=?",
      )
      .get(item.id) as {
      status: string;
      error_code: string;
      last_error: string;
    };
    expect(row.status).toBe("failed");
    expect(row.error_code).toBe("40310");
    expect(row.last_error).toBe("40310: 供应商错误 额度不足");
  });
});
