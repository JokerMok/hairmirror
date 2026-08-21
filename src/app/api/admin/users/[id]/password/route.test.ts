import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { closeDatabaseForTest, db } from "@/lib/database";
import { ADMIN_COOKIE, adminCookieValue } from "@/lib/session";
import { POST } from "./route";

let directory = "";

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "hair-admin-password-reset-"));
  process.env.SQLITE_PATH = join(directory, "test.db");
  process.env.ADMIN_USERNAME = "admin";
  process.env.ADMIN_PASSWORD = "admin_joker";
  process.env.PUBLIC_APP_URL = "https://hair.example";
});

afterEach(() => {
  closeDatabaseForTest();
  delete process.env.SQLITE_PATH;
  delete process.env.ADMIN_USERNAME;
  delete process.env.ADMIN_PASSWORD;
  delete process.env.PUBLIC_APP_URL;
  rmSync(directory, { recursive: true, force: true });
});

function insertUser() {
  const userId = crypto.randomUUID();
  db()
    .prepare(
      "INSERT INTO users(id,phone,email,name,password_hash,role,status,created_at) VALUES(?,?,?,?,?,'personal','active',?)",
    )
    .run(
      userId,
      `phone-${userId}`,
      `route-${userId}@example.com`,
      "Route test user",
      hashPassword("old-password"),
      new Date().toISOString(),
    );
  return userId;
}

function requestWithAdminCookie(userId: string, authenticated: boolean) {
  const headers = authenticated
    ? {
        cookie: `${ADMIN_COOKIE}=${adminCookieValue("admin", "admin_joker")}`,
      }
    : undefined;
  return new NextRequest(
    `https://hair.example/api/admin/users/${userId}/password`,
    { method: "POST", headers },
  );
}

describe("admin password reset route", () => {
  it("rejects requests without the admin session", async () => {
    const response = await POST(requestWithAdminCookie("missing", false), {
      params: Promise.resolve({ id: "missing" }),
    });

    expect(response.status).toBe(401);
  });

  it("resets the user password and redirects the operator", async () => {
    const userId = insertUser();
    const response = await POST(requestWithAdminCookie(userId, true), {
      params: Promise.resolve({ id: userId }),
    });

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://hair.example/admin/users?passwordReset=1",
    );
    const row = db()
      .prepare("SELECT password_hash FROM users WHERE id=?")
      .get(userId) as { password_hash: string };
    expect(verifyPassword("a00000000", row.password_hash)).toBe(true);
  });
});
