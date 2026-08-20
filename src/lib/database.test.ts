import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  closeDatabaseForTest,
  db,
  RUNNINGHUB_CHINA_ENDPOINT,
  RUNNINGHUB_INTERNATIONAL_COST_PER_IMAGE_MICROS,
  RUNNINGHUB_INTERNATIONAL_CURRENCY,
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
        "SELECT endpoint,cost_per_image_micros,currency FROM model_configs WHERE id='runninghub-g31-flash-lite'",
      )
      .get() as {
      endpoint: string;
      cost_per_image_micros: number;
      currency: string;
    };

    expect(row.endpoint).toBe(RUNNINGHUB_INTERNATIONAL_ENDPOINT);
    expect(row.cost_per_image_micros).toBe(
      RUNNINGHUB_INTERNATIONAL_COST_PER_IMAGE_MICROS,
    );
    expect(row.currency).toBe(RUNNINGHUB_INTERNATIONAL_CURRENCY);
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
    expect(row.cost_per_image_micros).toBe(
      RUNNINGHUB_INTERNATIONAL_COST_PER_IMAGE_MICROS,
    );
    expect(row.currency).toBe(RUNNINGHUB_INTERNATIONAL_CURRENCY);
    expect(custom.endpoint).toBe("https://custom.example/image-to-image");

    closeDatabaseForTest();
    const reopened = db();
    const rerun = reopened
      .prepare("SELECT updated_at FROM model_configs WHERE id=?")
      .get("runninghub-g31-flash-lite") as { updated_at: string };
    expect(rerun.updated_at).toBe(firstMigrationTimestamp);
  });

  it("migrates international pricing without changing protected model settings", () => {
    const database = db();
    database
      .prepare(
        "UPDATE model_configs SET endpoint=?,encrypted_api_key=?,enabled=?,priority=?,timeout_ms=?,cost_per_image_micros=?,currency=? WHERE id='runninghub-g31-flash-lite'",
      )
      .run(
        RUNNINGHUB_INTERNATIONAL_ENDPOINT,
        "encrypted-secret",
        1,
        7,
        91_000,
        70_000,
        "CNY",
      );

    closeDatabaseForTest();
    const migrated = db();
    const row = migrated
      .prepare("SELECT * FROM model_configs WHERE id=?")
      .get("runninghub-g31-flash-lite") as Record<string, unknown>;
    const firstMigrationTimestamp = String(row.updated_at);

    expect(row.endpoint).toBe(RUNNINGHUB_INTERNATIONAL_ENDPOINT);
    expect(row.cost_per_image_micros).toBe(
      RUNNINGHUB_INTERNATIONAL_COST_PER_IMAGE_MICROS,
    );
    expect(row.currency).toBe(RUNNINGHUB_INTERNATIONAL_CURRENCY);
    expect(row.encrypted_api_key).toBe("encrypted-secret");
    expect(row.enabled).toBe(1);
    expect(row.priority).toBe(7);
    expect(row.timeout_ms).toBe(91_000);

    closeDatabaseForTest();
    const reopened = db();
    const rerun = reopened
      .prepare("SELECT updated_at,cost_per_image_micros,currency FROM model_configs WHERE id=?")
      .get("runninghub-g31-flash-lite") as {
      updated_at: string;
      cost_per_image_micros: number;
      currency: string;
    };
    expect(rerun.updated_at).toBe(firstMigrationTimestamp);
    expect(rerun.cost_per_image_micros).toBe(
      RUNNINGHUB_INTERNATIONAL_COST_PER_IMAGE_MICROS,
    );
    expect(rerun.currency).toBe(RUNNINGHUB_INTERNATIONAL_CURRENCY);
  });

  it("adds a CNY snapshot to existing generation jobs without changing their costs", () => {
    const legacy = new DatabaseSync(process.env.SQLITE_PATH!);
    legacy.exec(`
      CREATE TABLE generation_jobs (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL UNIQUE,
        user_id TEXT,
        model_config_id TEXT,
        status TEXT NOT NULL,
        variant_count INTEGER NOT NULL,
        estimated_cost_micros INTEGER NOT NULL DEFAULT 0,
        actual_cost_micros INTEGER NOT NULL DEFAULT 0,
        error_code TEXT,
        attempts INTEGER NOT NULL DEFAULT 0,
        queued_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT
      );
      INSERT INTO generation_jobs(
        id,task_id,status,variant_count,estimated_cost_micros,actual_cost_micros,queued_at,completed_at
      ) VALUES('legacy-job','legacy-task','completed',3,210000,210000,'2026-08-01T00:00:00.000Z','2026-08-01T00:01:00.000Z');
    `);
    legacy.close();

    const migrated = db();
    const columns = migrated
      .prepare("PRAGMA table_info(generation_jobs)")
      .all() as Array<{ name: string; dflt_value: string | null }>;
    const row = migrated
      .prepare(
        "SELECT currency,estimated_cost_micros,actual_cost_micros FROM generation_jobs WHERE id='legacy-job'",
      )
      .get() as {
      currency: string;
      estimated_cost_micros: number;
      actual_cost_micros: number;
    };

    expect(columns.find((column) => column.name === "currency")?.dflt_value).toBe(
      "'CNY'",
    );
    expect(row).toEqual({
      currency: "CNY",
      estimated_cost_micros: 210000,
      actual_cost_micros: 210000,
    });
  });
});
