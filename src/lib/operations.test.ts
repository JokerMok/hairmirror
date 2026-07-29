import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDatabaseForTest, db } from "./database";
import { evaluateOperationalAlerts, listOperationalAlerts } from "./operations";

let directory = "";
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "hair-operations-"));
  process.env.SQLITE_PATH = join(directory, "test.db");
  process.env.ALERT_FAILURE_MIN_SAMPLES = "5";
  process.env.ALERT_FAILURE_RATE = "0.2";
  db();
});
afterEach(() => {
  closeDatabaseForTest();
  for (const key of [
    "SQLITE_PATH",
    "ALERT_FAILURE_MIN_SAMPLES",
    "ALERT_FAILURE_RATE",
  ])
    delete process.env[key];
  rmSync(directory, { recursive: true, force: true });
});
describe("operational alerts", () => {
  it("opens and later resolves a high failure-rate alert", () => {
    const now = Date.parse("2026-07-15T12:00:00.000Z");
    const insert = db().prepare(
      "INSERT INTO generation_jobs(id,task_id,user_id,model_config_id,status,variant_count,queued_at,completed_at) VALUES(?,?,NULL,'demo-fixed','failed',3,?,?)",
    );
    for (let index = 0; index < 5; index += 1)
      insert.run(
        crypto.randomUUID(),
        crypto.randomUUID(),
        new Date(now - 1000).toISOString(),
        new Date(now - 500).toISOString(),
      );
    expect(
      evaluateOperationalAlerts(now).alerts.some(
        (item) => item.code === "FAILURE_RATE",
      ),
    ).toBe(true);
    db()
      .prepare("UPDATE generation_jobs SET completed_at=?")
      .run(new Date(now - 2 * 60 * 60 * 1000).toISOString());
    evaluateOperationalAlerts(now);
    expect(
      listOperationalAlerts("open").some(
        (item) => item.code === "FAILURE_RATE",
      ),
    ).toBe(false);
  });
});
