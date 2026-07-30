import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hashPassword } from "../../src/lib/auth";
import { HAIRSTYLES } from "../../src/lib/catalog";
import {
  closeDatabaseForTest,
  db,
  getAuthUserById,
  type AuthUser,
} from "../../src/lib/database";
import {
  enqueueConsultationRecommendations,
  listConsultationRecommendationJobs,
  processNextGenerationJob,
} from "../../src/lib/generation-queue";
import { getTaskInternal } from "../../src/lib/task-store";
import { DEFAULT_DESIGN_PREFERENCES, type StoredDesignTask } from "../../src/lib/types";

let directory = "";
const userId = "00000000-0000-4000-8000-000000000451";
let user: AuthUser;

function makeTask(): StoredDesignTask {
  return {
    id: crypto.randomUUID(),
    ownerSessionId: "consultation-owner",
    userId,
    status: "queued",
    createdAt: new Date().toISOString(),
    generationMode: "demo-fixed",
    preferences: { ...DEFAULT_DESIGN_PREFERENCES },
    variants: HAIRSTYLES.slice(0, 3).map((template) => ({
      id: crypto.randomUUID(),
      template,
      reason: "consultation recommendation",
    })),
  };
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "hair-consultation-"));
  process.env.SQLITE_PATH = join(directory, "test.db");
  process.env.GENERATED_ASSETS_DIR = join(directory, "generated");
  process.env.SOURCE_UPLOADS_DIR = join(directory, "uploads");
  process.env.MODEL_SECRET_KEY = Buffer.alloc(32, 1).toString("base64");
  db()
    .prepare(
      "INSERT INTO users(id,phone,email,name,password_hash,role,status,created_at) VALUES(?,?,?,?,?,'personal','active',?)",
    )
    .run(
      userId,
      "consultation@example.com",
      "consultation@example.com",
      "Consultation User",
      hashPassword("password123"),
      new Date().toISOString(),
    );
  user = getAuthUserById(userId)!;
});

afterEach(() => {
  closeDatabaseForTest();
  for (const key of [
    "SQLITE_PATH",
    "GENERATED_ASSETS_DIR",
    "SOURCE_UPLOADS_DIR",
    "MODEL_SECRET_KEY",
  ]) delete process.env[key];
  rmSync(directory, { recursive: true, force: true });
});

describe("consultation recommendation queue linkage", () => {
  it("persists recommendation metadata and exposes durable completion state", async () => {
    const consultationId = "consultation-451";
    const recommendationId = "recommendation-451";
    const task = makeTask();
    const [queued] = enqueueConsultationRecommendations({
      consultationId,
      user,
      ownerKey: `user:${userId}`,
      recommendations: [
        {
          recommendationId,
          task,
          sourceImagePath: null,
          sourceExpiresAt: null,
        },
      ],
    });

    expect(queued).toMatchObject({ taskId: task.id, duplicate: false });
    expect(listConsultationRecommendationJobs(consultationId)).toMatchObject([
      {
        consultationId,
        recommendationId,
        taskId: task.id,
        jobId: queued.jobId,
        status: "queued",
        attempts: 0,
        maxAttempts: 3,
      },
    ]);

    expect(await processNextGenerationJob()).toMatchObject({
      status: "completed",
      jobId: queued.jobId,
    });
    expect(listConsultationRecommendationJobs(consultationId)[0]).toMatchObject({
      status: "completed",
      consultationId,
      recommendationId,
    });
    expect(getTaskInternal(task.id)?.status).toBe("completed");

    const payload = db()
      .prepare("SELECT payload_json FROM generation_job_payloads WHERE job_id=?")
      .get(queued.jobId) as { payload_json: string };
    expect(JSON.parse(payload.payload_json).queueMetadata).toEqual({
      consultationId,
      recommendationId,
    });
  });
});
