import { existsSync, mkdtempSync, rmSync } from "node:fs";
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
  requestConsultationRecommendationCancellation,
  processNextGenerationJob,
} from "../../src/lib/generation-queue";
import { deleteConsultation, actorFromAuthUser } from "../../src/lib/consultation-access";
import { getTaskInternal } from "../../src/lib/task-store";
import { persistSourceImage } from "../../src/lib/source-storage";
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
    "IMAGE_PROVIDER",
  ]) delete process.env[key];
  rmSync(directory, { recursive: true, force: true });
});

describe("consultation recommendation queue linkage", () => {
  it("persists recommendation metadata and exposes durable completion state", async () => {
    const consultationId = "consultation-451";
    const recommendationId = "recommendation-451";
    const task = makeTask();
    db()
      .prepare(
        "INSERT INTO salons(id,name,created_at,updated_at) VALUES(?,?,?,?)",
      )
      .run("salon-451", "Test salon", new Date().toISOString(), new Date().toISOString());
    db()
      .prepare(
        "INSERT INTO consultations(id,salon_id,customer_user_id,stylist_user_id,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
      )
      .run(
        consultationId,
        "salon-451",
        userId,
        null,
        "ready",
        new Date().toISOString(),
        new Date().toISOString(),
      );
    db()
      .prepare(
        "INSERT INTO recommendations(id,consultation_id,style_name,rationale,execution_json,image_url,rank,created_at) VALUES(?,?,?,?,?,?,?,?)",
      )
      .run(
        recommendationId,
        consultationId,
        "Natural Side Part",
        "Keeps the shape adaptable.",
        "{}",
        null,
        1,
        new Date().toISOString(),
      );
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
    expect(
      (
        db()
          .prepare("SELECT image_url FROM recommendations WHERE id=?")
          .get(recommendationId) as { image_url: string | null }
      ).image_url,
    ).toBe("/demo-results/textured-crop.png");

    const payload = db()
      .prepare("SELECT payload_json FROM generation_job_payloads WHERE job_id=?")
      .get(queued.jobId) as { payload_json: string };
    expect(JSON.parse(payload.payload_json).queueMetadata).toEqual({
      consultationId,
      recommendationId,
    });
  });

  it("keeps a consultation source until the consultation reference is deleted", async () => {
    const consultationId = "consultation-source-451";
    const recommendationId = "recommendation-source-451";
    const task = makeTask();
    const source = persistSourceImage("data:image/png;base64,iVBORw0KGgo=", task.id);
    db()
      .prepare(
        "INSERT INTO salons(id,name,created_at,updated_at) VALUES(?,?,?,?)",
      )
      .run("salon-source-451", "Source salon", new Date().toISOString(), new Date().toISOString());
    db()
      .prepare(
        "INSERT INTO consultations(id,salon_id,customer_user_id,status,source_photo_path,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
      )
      .run(
        consultationId,
        "salon-source-451",
        userId,
        "ready",
        source.path,
        new Date().toISOString(),
        new Date().toISOString(),
      );
    db()
      .prepare(
        "INSERT INTO recommendations(id,consultation_id,style_name,rationale,execution_json,rank,created_at) VALUES(?,?,?,?,?,?,?)",
      )
      .run(recommendationId, consultationId, "Natural Side Part", "A safe option.", "{}", 1, new Date().toISOString());

    const [queued] = enqueueConsultationRecommendations({
      consultationId,
      user,
      ownerKey: `user:${userId}`,
      recommendations: [{
        recommendationId,
        task,
        sourceImagePath: source.path,
        sourceExpiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      }],
    });
    expect(await processNextGenerationJob()).toMatchObject({ status: "completed", jobId: queued.jobId });
    expect(existsSync(source.path!)).toBe(true);

    deleteConsultation(db(), consultationId, actorFromAuthUser(user));
    expect(existsSync(source.path!)).toBe(false);
  });

  it("reserves one access unit for the three recommendation jobs in a consultation", async () => {
    const consultationId = "consultation-access-451";
    const recommendations = ["rec-access-1", "rec-access-2", "rec-access-3"];
    db()
      .prepare(
        "INSERT INTO salons(id,name,created_at,updated_at) VALUES(?,?,?,?)",
      )
      .run("salon-access-451", "Access salon", new Date().toISOString(), new Date().toISOString());
    db()
      .prepare(
        "INSERT INTO consultations(id,salon_id,customer_user_id,status,created_at,updated_at) VALUES(?,?,?,?,?,?)",
      )
      .run(consultationId, "salon-access-451", userId, "ready", new Date().toISOString(), new Date().toISOString());
    recommendations.forEach((recommendationId, index) => {
      db()
        .prepare(
          "INSERT INTO recommendations(id,consultation_id,style_name,rationale,execution_json,rank,created_at) VALUES(?,?,?,?,?,?,?)",
        )
        .run(recommendationId, consultationId, `Recommendation ${index + 1}`, "A suitable option.", "{}", index + 1, new Date().toISOString());
    });

    const queued = enqueueConsultationRecommendations({
      consultationId,
      user,
      ownerKey: `user:${userId}`,
      recommendations: recommendations.map((recommendationId) => ({
        recommendationId,
        task: makeTask(),
        sourceImagePath: null,
        sourceExpiresAt: null,
      })),
    });
    expect(queued).toHaveLength(3);
    expect(
      (db().prepare("SELECT COUNT(*) AS count FROM generation_access_charges").get() as { count: number }).count,
    ).toBe(1);
    for (let index = 0; index < 3; index += 1) {
      expect(await processNextGenerationJob()).toMatchObject({ status: "completed" });
    }
    expect(listConsultationRecommendationJobs(consultationId).every((job) => job.status === "completed")).toBe(true);
    expect((db().prepare("SELECT generation_status FROM consultations WHERE id=?").get(consultationId) as { generation_status: string }).generation_status).toBe("completed");
    expect((db().prepare("SELECT status FROM generation_access_charges").get() as { status: string }).status).toBe("consumed");
  });

  it("cancels a consultation recommendation without crossing its metadata boundary", () => {
    const consultationId = "consultation-cancel-451";
    const recommendationId = "recommendation-cancel-451";
    const task = makeTask();
    db()
      .prepare(
        "INSERT INTO salons(id,name,created_at,updated_at) VALUES(?,?,?,?)",
      )
      .run("salon-cancel-451", "Cancel salon", new Date().toISOString(), new Date().toISOString());
    db()
      .prepare(
        "INSERT INTO consultations(id,salon_id,customer_user_id,status,created_at,updated_at) VALUES(?,?,?,?,?,?)",
      )
      .run(consultationId, "salon-cancel-451", userId, "ready", new Date().toISOString(), new Date().toISOString());
    db()
      .prepare(
        "INSERT INTO recommendations(id,consultation_id,style_name,rationale,execution_json,rank,created_at) VALUES(?,?,?,?,?,?,?)",
      )
      .run(recommendationId, consultationId, "Natural Side Part", "A safe option.", "{}", 1, new Date().toISOString());
    enqueueConsultationRecommendations({
      consultationId,
      user,
      ownerKey: `user:${userId}`,
      recommendations: [{ recommendationId, task, sourceImagePath: null, sourceExpiresAt: null }],
    });

    expect(requestConsultationRecommendationCancellation(consultationId, recommendationId)).toMatchObject({
      ok: true,
      status: "cancelled",
      consultationId,
      recommendationId,
    });
    expect(listConsultationRecommendationJobs(consultationId)[0].status).toBe("cancelled");
    expect((db().prepare("SELECT generation_status FROM consultations WHERE id=?").get(consultationId) as { generation_status: string }).generation_status).toBe("cancelled");
    expect((db().prepare("SELECT status FROM generation_access_charges").get() as { status: string }).status).toBe("released");
  });

  it("releases the bundle when every preview returns an incomplete result", async () => {
    process.env.IMAGE_PROVIDER = "mock";
    const consultationId = "consultation-failed-bundle-451";
    const recommendations = ["rec-failed-1", "rec-failed-2", "rec-failed-3"];
    db().prepare("INSERT INTO salons(id,name,created_at,updated_at) VALUES(?,?,?,?)").run("salon-failed-451", "Failed salon", new Date().toISOString(), new Date().toISOString());
    db().prepare("INSERT INTO consultations(id,salon_id,customer_user_id,status,created_at,updated_at) VALUES(?,?,?,?,?,?)").run(consultationId, "salon-failed-451", userId, "ready", new Date().toISOString(), new Date().toISOString());
    recommendations.forEach((recommendationId, index) => {
      db().prepare("INSERT INTO recommendations(id,consultation_id,style_name,rationale,execution_json,rank,created_at) VALUES(?,?,?,?,?,?,?)").run(recommendationId, consultationId, `Failed option ${index + 1}`, "A test option.", "{}", index + 1, new Date().toISOString());
    });
    enqueueConsultationRecommendations({
      consultationId,
      user,
      ownerKey: `user:${userId}`,
      recommendations: recommendations.map((recommendationId) => ({ recommendationId, task: makeTask(), sourceImagePath: null, sourceExpiresAt: null })),
    });
    for (let index = 0; index < 3; index += 1) expect((await processNextGenerationJob()).status).toBe("failed");
    expect(listConsultationRecommendationJobs(consultationId).every((job) => job.status === "failed")).toBe(true);
    expect((db().prepare("SELECT generation_status FROM consultations WHERE id=?").get(consultationId) as { generation_status: string }).generation_status).toBe("failed");
    expect((db().prepare("SELECT status FROM generation_access_charges").get() as { status: string }).status).toBe("released");
    expect((db().prepare("SELECT trial_used,trial_reserved FROM generation_wallets WHERE owner_key=?").get(`user:${userId}`) as { trial_used: number; trial_reserved: number }).trial_used).toBe(0);
  });
});
