import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAuthSession, getUserByToken, hashPassword, verifyPassword } from "./auth";
import { closeDatabaseForTest, db, findUserByEmail } from "./database";
import { createPasswordResetToken, resetPassword } from "./password-reset";

let directory = "";
const userId = "00000000-0000-4000-8000-000000000701";

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "hair-password-reset-"));
  process.env.SQLITE_PATH = join(directory, "test.db");
  db()
    .prepare("INSERT INTO users(id,phone,email,name,password_hash,role,status,created_at) VALUES(?,?,?,?,?,'personal','active',?)")
    .run(userId, `email-${userId}`, "person@example.com", "Person", hashPassword("old-password"), new Date().toISOString());
});

afterEach(() => {
  closeDatabaseForTest();
  delete process.env.SQLITE_PATH;
  rmSync(directory, { recursive: true, force: true });
});

describe("password reset flow", () => {
  it("rotates the password, consumes the token, and clears sessions", () => {
    const session = createAuthSession(userId);
    const reset = createPasswordResetToken("person@example.com");
    expect(reset?.token).toBeTruthy();
    expect(resetPassword(reset!.token, "new-password")).toBe(true);
    expect(getUserByToken(session)).toBeNull();
    expect(verifyPassword("new-password", String(findUserByEmail("person@example.com")?.password_hash))).toBe(true);
    expect(resetPassword(reset!.token, "another-password")).toBe(false);
  });

  it("does not create a token for an unknown account", () => {
    expect(createPasswordResetToken("missing@example.com")).toBeNull();
  });
});
