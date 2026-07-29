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
import { createBackup } from "./backup";
import { closeDatabaseForTest, db } from "./database";

let directory = "";
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "hair-backup-"));
  process.env.SQLITE_PATH = join(directory, "data", "test.db");
  process.env.GENERATED_ASSETS_DIR = join(directory, "generated");
  process.env.BACKUP_DIR = join(directory, "backups");
  mkdirSync(process.env.GENERATED_ASSETS_DIR, { recursive: true });
  writeFileSync(join(process.env.GENERATED_ASSETS_DIR, "asset.png"), "image");
  db();
});
afterEach(() => {
  closeDatabaseForTest();
  for (const key of ["SQLITE_PATH", "GENERATED_ASSETS_DIR", "BACKUP_DIR"])
    delete process.env[key];
  rmSync(directory, { recursive: true, force: true });
});
describe("backup", () => {
  it("creates an integrity-checked database and asset snapshot", async () => {
    const result = await createBackup(new Date("2026-07-15T00:00:00.000Z"));
    const target = join(process.env.BACKUP_DIR!, result.id);
    expect(existsSync(join(target, "hairstyle.db"))).toBe(true);
    expect(existsSync(join(target, "generated", "asset.png"))).toBe(true);
    expect(existsSync(join(target, "manifest.json"))).toBe(true);
    expect(
      (
        db().prepare("SELECT COUNT(*) AS count FROM backup_runs").get() as {
          count: number;
        }
      ).count,
    ).toBe(1);
  });
});
