import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  billingState,
  entitledQuota,
  markStripeEvent,
  stripeEventProcessed,
  syncSubscription,
} from "./billing";
import { closeDatabaseForTest, db, getAuthUserById } from "./database";
import { hashPassword } from "./auth";
import { quotaForUser } from "./model-operations";

let directory = "";
const userId = "00000000-0000-4000-8000-000000000101";
function subscription(status: Stripe.Subscription.Status, id = "sub_test") {
  return {
    id,
    status,
    customer: "cus_test",
    cancel_at_period_end: false,
    metadata: { userId, planKey: "personal_plus" },
    items: {
      data: [
        {
          price: { id: "price_personal" },
          current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        },
      ],
    },
  } as unknown as Stripe.Subscription;
}
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "hair-billing-"));
  process.env.SQLITE_PATH = join(directory, "test.db");
  process.env.BILLING_PROVIDER = "stripe";
  process.env.STRIPE_PERSONAL_PRICE_ID = "price_personal";
  db()
    .prepare(
      "INSERT INTO users(id,phone,email,name,password_hash,role,status,created_at) VALUES(?,?,?,?,?,'personal','active',?)",
    )
    .run(
      userId,
      `email-${userId}`,
      "user@example.com",
      "User",
      hashPassword("password123"),
      new Date().toISOString(),
    );
});
afterEach(() => {
  closeDatabaseForTest();
  delete process.env.SQLITE_PATH;
  delete process.env.BILLING_PROVIDER;
  delete process.env.STRIPE_PERSONAL_PRICE_ID;
  rmSync(directory, { recursive: true, force: true });
});
describe("Stripe billing entitlements", () => {
  it("provisions and revokes subscription quota from webhook state", () => {
    const user = getAuthUserById(userId)!;
    expect(quotaForUser(user).limit).toBe(0);
    syncSubscription(subscription("active"));
    expect(billingState(userId)?.status).toBe("active");
    expect(entitledQuota(user, 30)).toBe(60);
    expect(quotaForUser(user).limit).toBe(60);
    syncSubscription(subscription("canceled"));
    expect(quotaForUser(user).limit).toBe(0);
  });
  it("records webhook event ids idempotently", () => {
    const event = {
      id: "evt_1",
      type: "customer.subscription.updated",
    } as Stripe.Event;
    expect(markStripeEvent(event)).toBe(true);
    expect(stripeEventProcessed(event.id)).toBe(true);
    expect(markStripeEvent(event)).toBe(false);
  });
  it("keeps a current active subscription ahead of a later stale cancellation", () => {
    syncSubscription(subscription("active", "sub_current"));
    syncSubscription(subscription("canceled", "sub_old"));
    expect(billingState(userId)?.status).toBe("active");
    expect(quotaForUser(getAuthUserById(userId)!).limit).toBe(60);
  });
});
