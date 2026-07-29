import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hashPassword } from "./auth";
import { closeDatabaseForTest, db, getAuthUserById } from "./database";
import { accessSummary } from "./entitlements";
import { billingState, entitledQuota } from "./billing";
import {
  claimPaddleEvent,
  failPaddleEvent,
  finishPaddleEvent,
  syncPaddleSubscription,
  syncPaddleTransaction,
  syncPaddleAdjustment,
} from "./paddle-billing";

let directory = "";
const userId = "00000000-0000-4000-8000-000000000301";

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "hair-paddle-"));
  process.env.SQLITE_PATH = join(directory, "test.db");
  process.env.BILLING_PROVIDER = "paddle";
  process.env.PADDLE_PERSONAL_PACK_PRICE_ID = "pri_pack";
  process.env.PADDLE_PERSONAL_PLUS_PRICE_ID = "pri_personal";
  process.env.PERSONAL_PACK_SETS = "5";
  db().prepare(
    "INSERT INTO users(id,phone,email,name,password_hash,role,status,created_at) VALUES(?,?,?,?,?,'personal','active',?)",
  ).run(userId, "paddle-user", "paddle@example.com", "User", hashPassword("password123"), new Date().toISOString());
});

afterEach(() => {
  closeDatabaseForTest();
  for (const key of ["SQLITE_PATH", "BILLING_PROVIDER", "PADDLE_PERSONAL_PACK_PRICE_ID", "PADDLE_PERSONAL_PLUS_PRICE_ID", "PERSONAL_PACK_SETS"])
    delete process.env[key];
  rmSync(directory, { recursive: true, force: true });
});

function transaction(id = "txn_1") {
  return {
    id,
    status: "completed",
    customerId: "ctm_1",
    subscriptionId: null,
    invoiceNumber: "1-1",
    currencyCode: "USD",
    customData: { userId, planCode: "personal_pack" },
    items: [{ price: { id: "pri_pack" } }],
    details: { totals: { total: "199" } },
    billedAt: "2026-07-21T00:00:00Z",
    createdAt: "2026-07-21T00:00:00Z",
  };
}

describe("Paddle billing", () => {
  it("grants a pack once even when the webhook is delivered twice", () => {
    expect(syncPaddleTransaction(transaction()).created).toBe(true);
    expect(syncPaddleTransaction(transaction()).created).toBe(false);
    const summary = accessSummary(getAuthUserById(userId)!, "session");
    expect(summary.kind).toBe("personal");
    expect(summary.kind === "personal" ? summary.creditSets : -1).toBe(5);
  });

  it("syncs and revokes subscription quota", () => {
    const input = {
      id: "sub_1",
      status: "active",
      customerId: "ctm_1",
      customData: { userId, planCode: "personal_plus" },
      items: [{ price: { id: "pri_personal" } }],
      currentBillingPeriod: { startsAt: "2026-07-01T00:00:00Z", endsAt: "2026-08-01T00:00:00Z" },
      nextBilledAt: "2026-08-01T00:00:00Z",
      scheduledChange: null,
      createdAt: "2026-07-01T00:00:00Z",
    };
    syncPaddleSubscription(input);
    expect(billingState(userId)?.status).toBe("active");
    expect(entitledQuota(getAuthUserById(userId)!, 0)).toBe(60);
    syncPaddleSubscription({ ...input, status: "canceled" });
    expect(entitledQuota(getAuthUserById(userId)!, 0)).toBe(0);
  });

  it("retries failed webhook events but ignores completed duplicates", () => {
    expect(claimPaddleEvent("evt_1", "transaction.completed")).toBe(true);
    failPaddleEvent("evt_1", new Error("temporary"));
    expect(claimPaddleEvent("evt_1", "transaction.completed")).toBe(true);
    finishPaddleEvent("evt_1");
    expect(claimPaddleEvent("evt_1", "transaction.completed")).toBe(false);
  });

  it("rejects a configured price that does not match custom data", () => {
    expect(() => syncPaddleTransaction({ ...transaction(), items: [{ price: { id: "pri_wrong" } }] })).toThrow("PADDLE_PRICE_MISMATCH");
  });

  it("reverses pack credits once after an approved refund", () => {
    syncPaddleTransaction(transaction());
    expect(syncPaddleAdjustment({ transactionId: "txn_1", action: "refund", status: "approved" }).changed).toBe(true);
    expect(syncPaddleAdjustment({ transactionId: "txn_1", action: "refund", status: "approved" }).changed).toBe(false);
    const summary = accessSummary(getAuthUserById(userId)!, "session");
    expect(summary.kind === "personal" ? summary.creditSets : -1).toBe(0);
  });
});
