import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AUTH_COOKIE, createAuthSession, hashPassword } from "../../src/lib/auth";
import { closeDatabaseForTest, db, getAuthUserById } from "../../src/lib/database";
import { POST } from "../../src/app/api/design-tasks/route";
import { DEFAULT_DESIGN_PREFERENCES } from "../../src/lib/types";

let directory = "";
let token = "";
const userId = "00000000-0000-4000-8000-000000000781";

function createRequest(preferences: Record<string, unknown>, key: string) {
  return new NextRequest("http://localhost/api/design-tasks", {
    method: "POST",
    headers: {
      cookie: `${AUTH_COOKIE}=${token}`,
      "content-type": "application/json",
      "idempotency-key": key,
    },
    body: JSON.stringify({ consent: true, preferences }),
  });
}

function count(table: string) {
  return Number((db().prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count);
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "hair-design-task-validation-"));
  process.env.SQLITE_PATH = join(directory, "test.db");
  process.env.GENERATED_ASSETS_DIR = join(directory, "generated");
  process.env.SOURCE_UPLOADS_DIR = join(directory, "uploads");
  process.env.DISABLE_INLINE_WORKER = "1";
  process.env.BILLING_PROVIDER = "disabled";
  db()
    .prepare("INSERT INTO users(id,phone,email,name,password_hash,role,status,created_at) VALUES(?,?,?,?,?,'personal','active',?)")
    .run(userId, "design-validation-781", "design-validation-781@example.com", "Design Validation", hashPassword("password123"), new Date().toISOString());
  token = createAuthSession(getAuthUserById(userId)!.id);
});

afterEach(() => {
  closeDatabaseForTest();
  for (const key of ["SQLITE_PATH", "GENERATED_ASSETS_DIR", "SOURCE_UPLOADS_DIR", "DISABLE_INLINE_WORKER", "BILLING_PROVIDER"]) delete process.env[key];
  rmSync(directory, { recursive: true, force: true });
});

describe("design task hair-color validation", () => {
  it("returns TARGET_HAIR_COLOR_REQUIRED before creating a task or reserving access", async () => {
    const response = await POST(
      createRequest({ ...DEFAULT_DESIGN_PREFERENCES, colorMode: "change", targetHairColor: "" }, "missing-color-781"),
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "TARGET_HAIR_COLOR_REQUIRED" });
    expect(count("design_tasks")).toBe(0);
    expect(count("generation_jobs")).toBe(0);
    expect(count("generation_access_charges")).toBe(0);
    expect(count("usage_quotas")).toBe(0);
  });

  it("persists a valid named target color without a provider call", async () => {
    const response = await POST(
      createRequest({ ...DEFAULT_DESIGN_PREFERENCES, colorMode: "change", targetHairColor: "dark_brown" }, "dark-brown-781"),
    );

    expect(response.status).toBe(202);
    const body = await response.json();
    expect(body.task.preferences).toMatchObject({ colorMode: "change", targetHairColor: "dark_brown" });
    const saved = db().prepare("SELECT preferences_json FROM design_tasks").get() as { preferences_json: string };
    expect(JSON.parse(saved.preferences_json)).toMatchObject({ colorMode: "change", targetHairColor: "dark_brown" });
    expect(count("generation_jobs")).toBe(1);
  });

  it("rejects an empty custom color before task creation", async () => {
    const response = await POST(
      createRequest({ ...DEFAULT_DESIGN_PREFERENCES, colorMode: "change", targetHairColor: "custom", customHairColor: "   " }, "custom-empty-781"),
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "CUSTOM_HAIR_COLOR_REQUIRED" });
    expect(count("design_tasks")).toBe(0);
    expect(count("generation_jobs")).toBe(0);
  });

  it("clears a residual target color in preserve mode before persistence", async () => {
    const response = await POST(
      createRequest({ ...DEFAULT_DESIGN_PREFERENCES, colorMode: "preserve", targetHairColor: "dark_brown" }, "preserve-residual-781"),
    );

    expect(response.status).toBe(202);
    const body = await response.json();
    expect(body.task.preferences).toMatchObject({ colorMode: "preserve" });
    expect(body.task.preferences.targetHairColor).toBeUndefined();
    const saved = db().prepare("SELECT preferences_json FROM design_tasks").get() as { preferences_json: string };
    expect(JSON.parse(saved.preferences_json).targetHairColor).toBeUndefined();
  });
});
