import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDatabaseForTest } from "./database";
import { allowGenerationRequest } from "./rate-limit";

let directory = "";
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "hair-rate-limit-"));
  process.env.SQLITE_PATH = join(directory, "test.db");
  process.env.GENERATION_RATE_LIMIT_15M = "2";
  process.env.GENERATION_RATE_LIMIT_DAILY = "2";
});
afterEach(() => {
  closeDatabaseForTest();
  delete process.env.SQLITE_PATH;
  delete process.env.GENERATION_RATE_LIMIT_15M;
  delete process.env.GENERATION_RATE_LIMIT_DAILY;
  rmSync(directory, { recursive: true, force: true });
});

describe("generation rate limit", () => {
  it("limits by owner and network and survives a database reopen", () => {
    const request = new NextRequest("http://localhost/api/design-tasks", {
      headers: { "x-forwarded-for": "203.0.113.8" },
    });
    expect(allowGenerationRequest(request, "session:a")).toBe(true);
    expect(allowGenerationRequest(request, "session:a")).toBe(true);
    closeDatabaseForTest();
    expect(allowGenerationRequest(request, "session:a")).toBe(false);
    expect(allowGenerationRequest(request, "session:b")).toBe(false);
  });
});
