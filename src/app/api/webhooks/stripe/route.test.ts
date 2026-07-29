import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hashPassword } from "@/lib/auth";
import { billingState, resetStripeClientForTest } from "@/lib/billing";
import { closeDatabaseForTest, db } from "@/lib/database";
import { POST } from "./route";

let directory = "";
const userId = "00000000-0000-4000-8000-000000000202";
const webhookSecret = "whsec_test_hairmirror";

function signedRequest(eventId = "evt_subscription_updated") {
  const payload = JSON.stringify({
    id: eventId,
    object: "event",
    type: "customer.subscription.updated",
    data: {
      object: {
        id: "sub_test_webhook",
        object: "subscription",
        status: "active",
        customer: "cus_test_webhook",
        cancel_at_period_end: false,
        metadata: { userId, planKey: "personal_plus" },
        items: {
          data: [
            {
              price: { id: "price_personal_test" },
              current_period_end: Math.floor(Date.now() / 1000) + 2_592_000,
            },
          ],
        },
      },
    },
  });
  const stripe = new Stripe("sk_test_placeholder");
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: webhookSecret,
  });
  return new NextRequest("http://localhost/api/webhooks/stripe", {
    method: "POST",
    body: payload,
    headers: { "stripe-signature": signature },
  });
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "hair-stripe-webhook-"));
  process.env.SQLITE_PATH = join(directory, "test.db");
  process.env.BILLING_PROVIDER = "stripe";
  process.env.STRIPE_SECRET_KEY = "sk_test_placeholder";
  process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;
  process.env.STRIPE_PERSONAL_PRICE_ID = "price_personal_test";
  resetStripeClientForTest();
  db()
    .prepare(
      "INSERT INTO users(id,phone,email,name,password_hash,role,status,created_at) VALUES(?,?,?,?,?,'personal','active',?)",
    )
    .run(
      userId,
      `email-${userId}`,
      "subscriber@example.com",
      "Subscriber",
      hashPassword("password123"),
      new Date().toISOString(),
    );
});

afterEach(() => {
  closeDatabaseForTest();
  delete process.env.SQLITE_PATH;
  delete process.env.BILLING_PROVIDER;
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  delete process.env.STRIPE_PERSONAL_PRICE_ID;
  resetStripeClientForTest();
  rmSync(directory, { recursive: true, force: true });
});

describe("Stripe webhook", () => {
  it("verifies the signature, provisions entitlement, and deduplicates delivery", async () => {
    const first = await POST(signedRequest());
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ received: true });
    expect(billingState(userId)?.status).toBe("active");

    const duplicate = await POST(signedRequest());
    expect(duplicate.status).toBe(200);
    expect(await duplicate.json()).toEqual({ received: true, duplicate: true });
  });

  it("rejects an invalid signature without changing billing state", async () => {
    const request = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: "{}",
      headers: { "stripe-signature": "invalid" },
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(billingState(userId)).toBeNull();
  });
});
