import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanupExpiredAssets } from "./asset-retention";
import { closeDatabaseForTest, db } from "./database";

let directory = "";
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "hair-retention-"));
  process.env.SQLITE_PATH = join(directory, "test.db");
  process.env.GENERATED_ASSETS_DIR = join(directory, "generated");
  mkdirSync(process.env.GENERATED_ASSETS_DIR, { recursive: true });
});
afterEach(() => {
  closeDatabaseForTest();
  delete process.env.SQLITE_PATH;
  delete process.env.GENERATED_ASSETS_DIR;
  rmSync(directory, { recursive: true, force: true });
});

describe("asset retention", () => {
  it("deletes expired database rows and files", () => {
    const file = join(process.env.GENERATED_ASSETS_DIR!, "expired.png");
    writeFileSync(file, "image");
    db()
      .prepare(
        "INSERT INTO generated_assets(id,task_id,owner_session_id,user_id,file_path,mime_type,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?)",
      )
      .run(
        "00000000-0000-4000-8000-000000000004",
        "task",
        "owner",
        null,
        file,
        "image/png",
        new Date().toISOString(),
        100,
      );
    expect(
      cleanupExpiredAssets(101, process.env.GENERATED_ASSETS_DIR!),
    ).toEqual({ found: 1, deleted: 1, skipped: 0 });
    expect(existsSync(file)).toBe(false);
    expect(
      (
        db()
          .prepare("SELECT COUNT(*) AS count FROM generated_assets")
          .get() as { count: number }
      ).count,
    ).toBe(0);
  });

  it("does not delete a file outside managed storage", () => {
    const file = join(directory, "outside.png");
    writeFileSync(file, "image");
    db()
      .prepare(
        "INSERT INTO generated_assets(id,task_id,owner_session_id,user_id,file_path,mime_type,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?)",
      )
      .run(
        "00000000-0000-4000-8000-000000000005",
        "task",
        "owner",
        null,
        file,
        "image/png",
        new Date().toISOString(),
        100,
      );
    expect(
      cleanupExpiredAssets(101, process.env.GENERATED_ASSETS_DIR!),
    ).toEqual({ found: 1, deleted: 0, skipped: 1 });
    expect(existsSync(file)).toBe(true);
  });
});
