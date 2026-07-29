import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDatabaseForTest, db } from "./database";
import {
  costSummary,
  enqueueGeneration,
  failGenerationJob,
  resetUserFreePreview,
  startGenerationJob,
} from "./model-operations";
import { hashPassword } from "./auth";

let directory = "";
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "hair-model-ops-"));
  process.env.SQLITE_PATH = join(directory, "test.db");
});
afterEach(() => {
  closeDatabaseForTest();
  delete process.env.SQLITE_PATH;
  rmSync(directory, { recursive: true, force: true });
});

describe("generation cost accounting", () => {
  it("keeps known provider cost on a failed job", () => {
    const job = enqueueGeneration(crypto.randomUUID(), null, 3);
    startGenerationJob(job.id);
    failGenerationJob(job.id, "MODEL_FAILED", 60_000);
    const row = db()
      .prepare(
        "SELECT status,actual_cost_micros FROM generation_jobs WHERE id=?",
      )
      .get(job.id) as { status: string; actual_cost_micros: number };
    expect(row).toMatchObject({ status: "failed", actual_cost_micros: 60_000 });
    expect(costSummary().totalCostMicros).toBe(60_000);
  });
});

describe("admin free preview reset", () => {
  it("restores a personal trial without changing purchased credits", () => {
    const userId = crypto.randomUUID();
    db()
      .prepare(
        "INSERT INTO users(id,phone,email,name,password_hash,role,status,created_at) VALUES(?,?,?,?,?,'personal','active',?)",
      )
      .run(
        userId,
        `email-${userId}`,
        "reset@example.com",
        "Reset user",
        hashPassword("password123"),
        new Date().toISOString(),
      );
    db()
      .prepare(
        "INSERT INTO generation_wallets(owner_key,user_id,trial_used,trial_reserved,credit_sets,credit_reserved,updated_at) VALUES(?,?,1,0,5,0,?)",
      )
      .run(`user:${userId}`, userId, new Date().toISOString());

    expect(resetUserFreePreview(userId)).toEqual({ ok: true });
    const wallet = db()
      .prepare(
        "SELECT trial_used,trial_reserved,credit_sets FROM generation_wallets WHERE user_id=?",
      )
      .get(userId);
    expect(wallet).toMatchObject({
      trial_used: 0,
      trial_reserved: 0,
      credit_sets: 5,
    });
  });

  it("does not reset while a free generation is reserved", () => {
    const userId = crypto.randomUUID();
    db()
      .prepare(
        "INSERT INTO users(id,phone,email,name,password_hash,role,status,created_at) VALUES(?,?,?,?,?,'personal','active',?)",
      )
      .run(
        userId,
        `email-${userId}`,
        "reserved@example.com",
        "Reserved user",
        hashPassword("password123"),
        new Date().toISOString(),
      );
    db()
      .prepare(
        "INSERT INTO generation_wallets(owner_key,user_id,trial_used,trial_reserved,credit_sets,credit_reserved,updated_at) VALUES(?,?,0,1,0,0,?)",
      )
      .run(`user:${userId}`, userId, new Date().toISOString());

    expect(resetUserFreePreview(userId)).toEqual({
      ok: false,
      reason: "TRIAL_IN_PROGRESS",
    });
  });
});
