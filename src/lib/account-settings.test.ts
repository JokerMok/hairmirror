import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  hashPassword,
  updateAccountPassword,
  updateAccountProfile,
  verifyPassword,
} from "./auth";
import { closeDatabaseForTest, db } from "./database";

let directory = "";
let userId = "";

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "hair-account-settings-"));
  process.env.SQLITE_PATH = join(directory, "test.db");
  userId = crypto.randomUUID();
  db()
    .prepare(
      "INSERT INTO users(id,phone,email,name,password_hash,role,status,created_at) VALUES(?,?,?,?,?,'personal','active',?)",
    )
    .run(
      userId,
      `email-${userId}`,
      "before@example.com",
      "Before",
      hashPassword("password123"),
      new Date().toISOString(),
    );
});

afterEach(() => {
  closeDatabaseForTest();
  delete process.env.SQLITE_PATH;
  rmSync(directory, { recursive: true, force: true });
});

describe("account settings", () => {
  it("updates profile only after verifying the current password", () => {
    expect(
      updateAccountProfile({
        userId,
        name: "After",
        currentPassword: "wrong-password",
      }),
    ).toEqual({ ok: false, reason: "INVALID_PASSWORD" });
    expect(
      updateAccountProfile({
        userId,
        name: "After",
        currentPassword: "password123",
      }),
    ).toEqual({ ok: true });
    expect(
      db().prepare("SELECT name,email FROM users WHERE id=?").get(userId),
    ).toMatchObject({ name: "After", email: "before@example.com" });
  });

  it("changes the password and invalidates existing sessions", () => {
    db()
      .prepare(
        "INSERT INTO auth_sessions(id,user_id,token_hash,expires_at,created_at) VALUES(?,?,?,?,?)",
      )
      .run(
        crypto.randomUUID(),
        userId,
        "old-token",
        Date.now() + 10_000,
        new Date().toISOString(),
      );
    expect(
      updateAccountPassword({
        userId,
        currentPassword: "password123",
        newPassword: "new-password-456",
      }),
    ).toEqual({ ok: true });
    const row = db()
      .prepare("SELECT password_hash FROM users WHERE id=?")
      .get(userId) as { password_hash: string };
    expect(verifyPassword("new-password-456", row.password_hash)).toBe(true);
    expect(
      db()
        .prepare("SELECT COUNT(*) AS count FROM auth_sessions WHERE user_id=?")
        .get(userId),
    ).toMatchObject({ count: 0 });
  });
});
