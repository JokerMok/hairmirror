import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { findUserByEmail, closeDatabaseForTest } from "@/lib/database";
import { POST as login } from "./login/route";
import { POST as register } from "./register/route";

let directory = "";

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "hair-email-auth-"));
  process.env.SQLITE_PATH = join(directory, "test.db");
});

afterEach(() => {
  closeDatabaseForTest();
  delete process.env.SQLITE_PATH;
  rmSync(directory, { recursive: true, force: true });
});

describe("email-first authentication", () => {
  it("registers and signs in a US-style email account", async () => {
    const email = `person-${crypto.randomUUID()}@example.com`;
    const registration = await register(
      new NextRequest("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          password: "password123",
          name: "Taylor",
          accountType: "personal",
        }),
      }),
    );
    expect(registration.status).toBe(201);
    expect(findUserByEmail(email)?.email).toBe(email);

    const response = await login(
      new NextRequest("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identifier: email, password: "password123" }),
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("hair_auth=");
  });
});
