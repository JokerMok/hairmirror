import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { hashPassword } from "@/lib/auth";
import { closeDatabaseForTest, db } from "@/lib/database";
import { ADMIN_COOKIE, adminCookieValue } from "@/lib/session";
import { GET } from "./route";

let directory = "";

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "hair-generated-assets-"));
  process.env.SQLITE_PATH = join(directory, "test.db");
  process.env.ADMIN_USERNAME = "admin";
  process.env.ADMIN_PASSWORD = "admin_joker";
});

afterEach(() => {
  closeDatabaseForTest();
  delete process.env.SQLITE_PATH;
  delete process.env.ADMIN_USERNAME;
  delete process.env.ADMIN_PASSWORD;
  rmSync(directory, { recursive: true, force: true });
});

function requestForAsset(id: string, admin = false) {
  return new NextRequest(`https://hair.example/api/generated-assets/${id}`, {
    headers: admin
      ? { cookie: `${ADMIN_COOKIE}=${adminCookieValue("admin", "admin_joker")}` }
      : undefined,
  });
}

function insertAsset() {
  const id = crypto.randomUUID();
  const taskId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const filePath = join(directory, "generated.jpg");
  const image = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  writeFileSync(filePath, image);
  db()
    .prepare(
      "INSERT INTO users(id,phone,email,name,password_hash,role,status,created_at) VALUES(?,?,?,?,?,'personal','active',?)",
    )
    .run(
      userId,
      `phone-${userId}`,
      `asset-${userId}@example.com`,
      "Asset owner",
      hashPassword("password123"),
      new Date().toISOString(),
    );
  db()
    .prepare(
      "INSERT INTO generated_assets(id,task_id,owner_session_id,user_id,file_path,mime_type,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?)",
    )
    .run(
      id,
      taskId,
      "another-session",
      userId,
      filePath,
      "image/jpeg",
      new Date().toISOString(),
      Date.now() + 60_000,
    );
  return { id, image };
}

describe("generated asset access", () => {
  it("allows an authenticated admin to preview another user's image", async () => {
    const asset = insertAsset();
    const response = await GET(requestForAsset(asset.id, true), {
      params: Promise.resolve({ id: asset.id }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(asset.image);
  });

  it("does not make another user's image public", async () => {
    const asset = insertAsset();
    const response = await GET(requestForAsset(asset.id), {
      params: Promise.resolve({ id: asset.id }),
    });

    expect(response.status).toBe(404);
  });
});
