import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  closeDatabaseForTest,
  db,
  RUNNINGHUB_CHINA_ENDPOINT,
  RUNNINGHUB_INTERNATIONAL_ENDPOINT,
} from "./database";

let directory = "";

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "hair-database-"));
  process.env.SQLITE_PATH = join(directory, "test.db");
});

afterEach(() => {
  closeDatabaseForTest();
  delete process.env.SQLITE_PATH;
  rmSync(directory, { recursive: true, force: true });
});

describe("database model defaults", () => {
  it("writes the RunningHub international endpoint by default", () => {
    const row = db()
      .prepare(
        "SELECT endpoint FROM model_configs WHERE id='runninghub-g31-flash-lite'",
      )
      .get() as { endpoint: string };

    expect(row.endpoint).toBe(RUNNINGHUB_INTERNATIONAL_ENDPOINT);
  });

  it("migrates only the exact legacy endpoint and preserves model settings", () => {
    const database = db();
    database
      .prepare(
        "UPDATE model_configs SET endpoint=?,encrypted_api_key=?,enabled=?,priority=?,timeout_ms=?,cost_per_image_micros=?,currency=? WHERE id='runninghub-g31-flash-lite'",
      )
      .run(RUNNINGHUB_CHINA_ENDPOINT, "encrypted-secret", 1, 7, 91_000, 1234, "USD");
    database
      .prepare(
        "INSERT INTO model_configs(id,name,provider,model,endpoint,encrypted_api_key,enabled,priority,timeout_ms,cost_per_image_micros,currency,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
      )
      .run(
        "custom-runninghub",
        "Custom RunningHub",
        "runninghub",
        "custom-model",
        "https://custom.example/image-to-image",
        "custom-encrypted-secret",
        1,
        3,
        12_000,
        55,
        "USD",
        "2026-01-01T00:00:00.000Z",
        "2026-01-01T00:00:00.000Z",
      );

    closeDatabaseForTest();
    const migrated = db();
    const row = migrated
      .prepare("SELECT * FROM model_configs WHERE id=?")
      .get("runninghub-g31-flash-lite") as Record<string, unknown>;
    const custom = migrated
      .prepare("SELECT * FROM model_configs WHERE id=?")
      .get("custom-runninghub") as Record<string, unknown>;
    const firstMigrationTimestamp = String(row.updated_at);

    expect(row.endpoint).toBe(RUNNINGHUB_INTERNATIONAL_ENDPOINT);
    expect(row.encrypted_api_key).toBe("encrypted-secret");
    expect(row.enabled).toBe(1);
    expect(row.priority).toBe(7);
    expect(row.timeout_ms).toBe(91_000);
    expect(row.cost_per_image_micros).toBe(1234);
    expect(row.currency).toBe("USD");
    expect(custom.endpoint).toBe("https://custom.example/image-to-image");

    closeDatabaseForTest();
    const reopened = db();
    const rerun = reopened
      .prepare("SELECT updated_at FROM model_configs WHERE id=?")
      .get("runninghub-g31-flash-lite") as { updated_at: string };
    expect(rerun.updated_at).toBe(firstMigrationTimestamp);
  });
});
