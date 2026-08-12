import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AUTH_COOKIE, createAuthSession, hashPassword } from "../../src/lib/auth";
import { closeDatabaseForTest, db, getAuthUserById } from "../../src/lib/database";
import { GET, PATCH } from "../../src/app/api/consultations/[id]/route";
import { GET as GET_CONSULTATIONS, POST } from "../../src/app/api/consultations/route";

let directory = "";
const userId = "00000000-0000-4000-8000-000000000551";
const consultationId = "consultation-api-551";
const recommendationIds = ["recommendation-api-1", "recommendation-api-2", "recommendation-api-3"];
let token = "";

function request(action?: Record<string, unknown>) {
  return new NextRequest(`http://localhost/api/consultations/${consultationId}`, {
    method: action ? "PATCH" : "GET",
    headers: { cookie: `${AUTH_COOKIE}=${token}` },
    ...(action ? { body: JSON.stringify(action), headers: { cookie: `${AUTH_COOKIE}=${token}`, "content-type": "application/json" } } : {}),
  });
}

function createRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/consultations", {
    method: "POST",
    headers: { cookie: `${AUTH_COOKIE}=${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function consultationImageDataUrl(width = 512, height = 512) {
  const bytes = Buffer.alloc(33);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "hair-consultation-api-"));
  process.env.SQLITE_PATH = join(directory, "test.db");
  process.env.GENERATED_ASSETS_DIR = join(directory, "generated");
  process.env.SOURCE_UPLOADS_DIR = join(directory, "uploads");
  process.env.MODEL_SECRET_KEY = Buffer.alloc(32, 1).toString("base64");
  process.env.DISABLE_INLINE_WORKER = "1";
  db()
    .prepare(
      "INSERT INTO users(id,phone,email,name,password_hash,role,status,created_at) VALUES(?,?,?,?,?,'store_owner','active',?)",
    )
    .run(userId, "api-owner-551", "api-owner-551@example.com", "API Owner", hashPassword("password123"), new Date().toISOString());
  db()
    .prepare("INSERT INTO stores(id,name,owner_user_id,created_at) VALUES(?,?,?,?)")
    .run("salon-api-551", "API Salon", userId, new Date().toISOString());
  db()
    .prepare("INSERT INTO store_members(store_id,user_id,created_at) VALUES(?,?,?)")
    .run("salon-api-551", userId, new Date().toISOString());
  db()
    .prepare("INSERT INTO salons(id,name,owner_user_id,created_at,updated_at) VALUES(?,?,?,?,?)")
    .run("salon-api-551", "API Salon", userId, new Date().toISOString(), new Date().toISOString());
  const user = getAuthUserById(userId);
  token = createAuthSession(user!.id);
  db()
    .prepare("INSERT INTO consultations(id,salon_id,stylist_user_id,status,created_at,updated_at) VALUES(?,?,?,?,?,?)")
    .run(consultationId, "salon-api-551", userId, "ready", new Date().toISOString(), new Date().toISOString());
  recommendationIds.forEach((id, index) => {
    db()
      .prepare("INSERT INTO recommendations(id,consultation_id,style_name,rationale,execution_json,rank,created_at) VALUES(?,?,?,?,?,?,?)")
      .run(id, consultationId, `Recommendation ${index + 1}`, "A practical option.", "{}", index + 1, new Date().toISOString());
  });
});

afterEach(() => {
  closeDatabaseForTest();
  for (const key of ["SQLITE_PATH", "GENERATED_ASSETS_DIR", "SOURCE_UPLOADS_DIR", "MODEL_SECRET_KEY", "DISABLE_INLINE_WORKER"]) delete process.env[key];
  rmSync(directory, { recursive: true, force: true });
});

describe("consultation generation API", () => {
  it("rejects a consultation without a source photo", async () => {
    const response = await POST(createRequest({ idempotencyKey: "missing-photo-551" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "INVALID_CONSULTATION_INPUT" });
    expect(
      (db().prepare("SELECT COUNT(*) AS count FROM consultations WHERE salon_id=?").get("salon-api-551") as { count: number }).count,
    ).toBe(1);
  });

  it("rejects a low-resolution photo before persisting it", async () => {
    const response = await POST(createRequest({
      idempotencyKey: "low-quality-551",
      imageDataUrl: consultationImageDataUrl(128, 128),
      consentAccepted: true,
      photoQualityConfirmed: true,
    }));
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "SOURCE_IMAGE_QUALITY_INVALID" });
  });

  it("lets a personal user own a consultation and enqueue its previews", async () => {
    const personalId = "00000000-0000-4000-8000-000000000552";
    db()
      .prepare("INSERT INTO users(id,phone,email,name,password_hash,role,status,created_at) VALUES(?,?,?,?,?,'personal','active',?)")
      .run(personalId, "personal-552", "personal-552@example.com", "Personal 552", "hash", new Date().toISOString());
    const personalToken = createAuthSession(personalId);
    const personalRequest = (body: Record<string, unknown>) => new NextRequest("http://localhost/api/consultations", {
      method: "POST",
      headers: { cookie: `${AUTH_COOKIE}=${personalToken}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const created = await POST(personalRequest({
      idempotencyKey: "personal-consultation-552",
      imageDataUrl: consultationImageDataUrl(),
      consentAccepted: true,
      photoQualityConfirmed: true,
    }));
    expect(created.status).toBe(201);
    const createdBody = await created.json();
    expect(createdBody.item).toMatchObject({ salonId: null, customerUserId: personalId, generationStatus: "idle" });
    expect(createdBody.item.sourcePhotoPath).toBeUndefined();

    const personalConsultationId = String(createdBody.item.id);
    db().prepare("UPDATE consultations SET status='ready' WHERE id=?").run(personalConsultationId);
    recommendationIds.forEach((recommendationId, index) => {
      db().prepare("INSERT INTO recommendations(id,consultation_id,style_name,rationale,execution_json,rank,created_at) VALUES(?,?,?,?,?,?,?)")
        .run(`personal-${recommendationId}`, personalConsultationId, `Personal option ${index + 1}`, "A practical option.", "{}", index + 1, new Date().toISOString());
    });
    const generated = await PATCH(new NextRequest(`http://localhost/api/consultations/${personalConsultationId}`, {
      method: "PATCH",
      headers: { cookie: `${AUTH_COOKIE}=${personalToken}`, "content-type": "application/json" },
      body: JSON.stringify({ action: "generate" }),
    }), { params: Promise.resolve({ id: personalConsultationId }) });
    expect(generated.status).toBe(202);
    expect((await generated.json()).consultation.generationJobs).toHaveLength(3);

    const history = await GET_CONSULTATIONS(new NextRequest("http://localhost/api/consultations", { headers: { cookie: `${AUTH_COOKIE}=${personalToken}` } }));
    expect((await history.json()).consultations.map((item: { id: string }) => item.id)).toContain(personalConsultationId);
  });

  it("returns safe details, queues three jobs once, and cancels one recommendation", async () => {
    const before = await GET(request(), { params: Promise.resolve({ id: consultationId }) });
    const beforeBody = await before.json();
    expect(before.status).toBe(200);
    expect(beforeBody.consultation.sourcePhotoPath).toBeUndefined();
    expect(beforeBody.consultation.generationJobs).toEqual([]);

    const generated = await PATCH(request({ action: "generate" }), { params: Promise.resolve({ id: consultationId }) });
    const generatedBody = await generated.json();
    expect(generated.status).toBe(202);
    expect(generatedBody.consultation.generationJobs).toHaveLength(3);
    expect(
      (db().prepare("SELECT COUNT(*) AS count FROM generation_jobs").get() as { count: number }).count,
    ).toBe(3);
    expect(
      (db().prepare("SELECT COUNT(*) AS count FROM generation_access_charges").get() as { count: number }).count,
    ).toBe(1);

    const duplicate = await PATCH(request({ action: "generate" }), { params: Promise.resolve({ id: consultationId }) });
    expect(duplicate.status).toBe(202);
    expect(
      (db().prepare("SELECT COUNT(*) AS count FROM generation_jobs").get() as { count: number }).count,
    ).toBe(3);

    const cancelled = await PATCH(
      request({ action: "cancel", recommendationId: recommendationIds[0] }),
      { params: Promise.resolve({ id: consultationId }) },
    );
    const cancelledBody = await cancelled.json();
    expect(cancelled.status).toBe(200);
    expect(
      cancelledBody.consultation.generationJobs.find((job: { recommendationId: string }) => job.recommendationId === recommendationIds[0]).status,
    ).toBe("cancelled");
  });

  it("returns a recoverable error instead of accepting generation without an active model", async () => {
    db().prepare("UPDATE model_configs SET enabled=0").run();
    const response = await PATCH(request({ action: "generate" }), { params: Promise.resolve({ id: consultationId }) });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "MODEL_UNAVAILABLE" });
    expect(
      (db().prepare("SELECT COUNT(*) AS count FROM generation_jobs").get() as { count: number }).count,
    ).toBe(0);
  });
});
