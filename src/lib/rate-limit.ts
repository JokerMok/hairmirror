import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { db } from "./database";

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
function identityHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function networkIdentity(request: NextRequest) {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  return (
    forwarded || request.headers.get("x-real-ip")?.trim() || "local-development"
  );
}

function consume(
  scope: string,
  identity: string,
  windowMs: number,
  limit: number,
  now = Date.now(),
) {
  const database = db();
  const hash = identityHash(identity);
  const cutoff = now - windowMs;
  database.exec("BEGIN IMMEDIATE");
  try {
    database
      .prepare("DELETE FROM rate_limit_events WHERE occurred_at<?")
      .run(now - 24 * 60 * 60 * 1000);
    const row = database
      .prepare(
        "SELECT COUNT(*) AS count FROM rate_limit_events WHERE scope=? AND identity_hash=? AND occurred_at>?",
      )
      .get(scope, hash, cutoff) as { count: number };
    if (Number(row.count) >= limit) {
      database.exec("COMMIT");
      return false;
    }
    database
      .prepare(
        "INSERT INTO rate_limit_events(id,scope,identity_hash,occurred_at) VALUES(?,?,?,?)",
      )
      .run(crypto.randomUUID(), scope, hash, now);
    database.exec("COMMIT");
    return true;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function allowGenerationRequest(
  request: NextRequest,
  ownerIdentity: string,
) {
  const fifteenMinuteLimit = positiveInteger(
    process.env.GENERATION_RATE_LIMIT_15M,
    10,
  );
  const dailyLimit = positiveInteger(
    process.env.GENERATION_RATE_LIMIT_DAILY,
    30,
  );
  const globalDailyLimit = positiveInteger(
    process.env.GENERATION_GLOBAL_DAILY_LIMIT,
    100,
  );
  const network = networkIdentity(request);
  return (
    consume(
      "generation-15m-owner",
      ownerIdentity,
      15 * 60 * 1000,
      fifteenMinuteLimit,
    ) &&
    consume(
      "generation-15m-network",
      network,
      15 * 60 * 1000,
      fifteenMinuteLimit,
    ) &&
    consume(
      "generation-day-owner",
      ownerIdentity,
      24 * 60 * 60 * 1000,
      dailyLimit,
    ) &&
    consume(
      "generation-day-network",
      network,
      24 * 60 * 60 * 1000,
      dailyLimit,
    ) &&
    consume(
      "generation-day-global",
      "platform",
      24 * 60 * 60 * 1000,
      globalDailyLimit,
    )
  );
}
