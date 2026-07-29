import Stripe from "stripe";
import type { AuthUser } from "./database";
import { db } from "./database";
import {
  gumroadBillingState,
  gumroadCheckoutUrl,
  gumroadProductId,
} from "./gumroad-billing";
import { paddlePriceDetails } from "./paddle-billing";

export type PlanKey = "personal_plus" | "salon_pro";
export type BillingCatalogEntry = {
  key: PlanKey;
  name: string;
  quota: number;
  productId: string | null;
  priceId: string | null;
  unitAmount: number | null;
  currency: string;
  interval: "day" | "week" | "month" | "year" | null;
  active: boolean;
  provider: "gumroad" | "stripe" | "paddle";
  checkoutUrl: string | null;
};

function gumroadMonthlyPriceCents(key: PlanKey) {
  const variable =
    key === "personal_plus"
      ? process.env.GUMROAD_PERSONAL_MONTHLY_PRICE_USD
      : process.env.GUMROAD_SALON_MONTHLY_PRICE_USD;
  const dollars = Number(variable);
  return Number.isFinite(dollars) && dollars > 0
    ? Math.round(dollars * 100)
    : null;
}
export const BILLING_PLANS: Record<
  PlanKey,
  {
    priceEnv: string;
    quota: number;
    roles: AuthUser["role"][];
    name: { en: string; zh: string };
  }
> = {
  personal_plus: {
    priceEnv: "STRIPE_PERSONAL_PRICE_ID",
    quota: Number(process.env.PERSONAL_PLUS_MONTHLY_IMAGES) || 60,
    roles: ["personal"],
    name: { en: "Personal Plus", zh: "个人进阶版" },
  },
  salon_pro: {
    priceEnv: "STRIPE_SALON_PRICE_ID",
    quota: Number(process.env.SALON_PRO_MONTHLY_IMAGES) || 600,
    roles: ["store_owner"],
    name: { en: "Salon Pro", zh: "门店专业版" },
  },
};

let client: Stripe | undefined;
export function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_NOT_CONFIGURED");
  client ??= new Stripe(key);
  return client;
}
export function resetStripeClientForTest() {
  if (process.env.NODE_ENV !== "test") throw new Error("TEST_ONLY");
  client = undefined;
}
export function planPriceId(plan: PlanKey) {
  return process.env[BILLING_PLANS[plan].priceEnv] ?? null;
}
export function planForPrice(priceId: string) {
  return (
    (Object.keys(BILLING_PLANS) as PlanKey[]).find(
      (key) => planPriceId(key) === priceId,
    ) ?? null
  );
}
export function isPlanKey(value: string): value is PlanKey {
  return value in BILLING_PLANS;
}

export function billingProvider(): "gumroad" | "stripe" | "paddle" {
  if (process.env.BILLING_PROVIDER === "paddle") return "paddle";
  return process.env.BILLING_PROVIDER === "stripe" ? "stripe" : "gumroad";
}

export async function validateUsdRecurringPrice(priceId: string) {
  const price = await stripeClient().prices.retrieve(priceId);
  if (!price.active || price.currency !== "usd" || !price.recurring)
    throw new Error("BILLING_PRICE_INVALID");
  return price;
}

export function billingState(userId: string, now = Date.now()) {
  if (billingProvider() === "gumroad") return gumroadBillingState(userId, now);
  if (billingProvider() === "paddle") {
    const row = db()
      .prepare(
        `SELECT * FROM paddle_subscriptions WHERE user_id=?
         ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'trialing' THEN 1
         WHEN 'past_due' THEN 2 ELSE 3 END, updated_at DESC LIMIT 1`,
      )
      .get(userId) as Record<string, unknown> | undefined;
    const paddleState = row
      ? {
          provider: "paddle" as const,
          planKey: String(row.plan_key) as PlanKey,
          status: String(row.status),
          periodEnd: row.next_billed_at ? Number(row.next_billed_at) : null,
          cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
          customerId: String(row.customer_id),
          lastVerifiedAt: null,
          verificationError: null,
        }
      : null;
    if (paddleState && ["active", "trialing", "past_due"].includes(paddleState.status))
      return paddleState;
    return gumroadBillingState(userId, now) ?? paddleState;
  }
  const row = db()
    .prepare(
      `SELECT * FROM billing_subscriptions WHERE user_id=?
       ORDER BY CASE status
         WHEN 'active' THEN 0
         WHEN 'trialing' THEN 1
         WHEN 'past_due' THEN 2
         ELSE 3
       END, updated_at DESC LIMIT 1`,
    )
    .get(userId) as Record<string, unknown> | undefined;
  return row
    ? {
        provider: "stripe" as const,
        planKey: String(row.plan_key) as PlanKey,
        status: String(row.status),
        periodEnd: row.current_period_end
          ? Number(row.current_period_end)
          : null,
        cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
        customerId: String(row.stripe_customer_id),
        lastVerifiedAt: null,
        verificationError: null,
      }
    : null;
}
export function entitledQuota(user: AuthUser, base: number, now = Date.now()) {
  let state = billingState(user.id, now);
  if (!state && user.role === "staff" && user.storeId) {
    const owner = db()
      .prepare(
        `SELECT s.owner_user_id AS id FROM stores s
         WHERE s.id=? LIMIT 1`,
      )
      .get(user.storeId) as { id?: string } | undefined;
    if (owner?.id) state = billingState(owner.id, now);
  }
  if (!state) return base;
  const eligible =
    state.status === "active" ||
    ((state.provider === "stripe" || state.provider === "paddle") &&
      state.status === "trialing") ||
    (state.status === "past_due" &&
      Boolean(state.periodEnd && state.periodEnd > now));
  return eligible && BILLING_PLANS[state.planKey]
    ? Math.max(base, BILLING_PLANS[state.planKey].quota)
    : base;
}

export async function getOrCreateBillingCustomer(user: AuthUser) {
  const existing = db()
    .prepare("SELECT stripe_customer_id FROM billing_customers WHERE user_id=?")
    .get(user.id) as { stripe_customer_id?: string } | undefined;
  if (existing?.stripe_customer_id) return existing.stripe_customer_id;
  const customer = await stripeClient().customers.create(
    {
      email: user.email ?? undefined,
      name: user.name,
      metadata: { userId: user.id },
    },
    { idempotencyKey: `hairmirror-customer-${user.id}` },
  );
  const now = new Date().toISOString();
  db()
    .prepare(
      "INSERT INTO billing_customers(user_id,stripe_customer_id,created_at,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET stripe_customer_id=excluded.stripe_customer_id,updated_at=excluded.updated_at",
    )
    .run(user.id, customer.id, now, now);
  return customer.id;
}

function subscriptionPeriodEnd(subscription: Stripe.Subscription) {
  return (
    subscription.items.data.reduce(
      (latest, item) => Math.max(latest, item.current_period_end ?? 0),
      0,
    ) || null
  );
}
export function syncSubscription(subscription: Stripe.Subscription) {
  const userId = subscription.metadata.userId;
  const priceId = subscription.items.data[0]?.price.id;
  const planKey =
    subscription.metadata.planKey && isPlanKey(subscription.metadata.planKey)
      ? subscription.metadata.planKey
      : priceId
        ? planForPrice(priceId)
        : null;
  if (!userId || !priceId || !planKey)
    throw new Error("BILLING_METADATA_MISSING");
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;
  const now = new Date().toISOString();
  const database = db();
  database.exec("BEGIN IMMEDIATE");
  try {
    database
      .prepare(
        `INSERT INTO billing_subscriptions(stripe_subscription_id,user_id,stripe_customer_id,plan_key,price_id,status,current_period_end,cancel_at_period_end,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(stripe_subscription_id) DO UPDATE SET plan_key=excluded.plan_key,price_id=excluded.price_id,status=excluded.status,current_period_end=excluded.current_period_end,cancel_at_period_end=excluded.cancel_at_period_end,updated_at=excluded.updated_at`,
      )
      .run(
        subscription.id,
        userId,
        customerId,
        planKey,
        priceId,
        subscription.status,
        subscriptionPeriodEnd(subscription),
        subscription.cancel_at_period_end ? 1 : 0,
        now,
        now,
      );
    database
      .prepare(
        "INSERT INTO billing_customers(user_id,stripe_customer_id,created_at,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET stripe_customer_id=excluded.stripe_customer_id,updated_at=excluded.updated_at",
      )
      .run(userId, customerId, now, now);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  return { userId, planKey, status: subscription.status };
}

export function markStripeEvent(event: Stripe.Event) {
  const database = db();
  if (
    database
      .prepare("SELECT 1 FROM stripe_events WHERE event_id=?")
      .get(event.id)
  )
    return false;
  database
    .prepare(
      "INSERT INTO stripe_events(event_id,event_type,processed_at) VALUES(?,?,?)",
    )
    .run(event.id, event.type, new Date().toISOString());
  return true;
}
export function stripeEventProcessed(eventId: string) {
  return Boolean(
    db().prepare("SELECT 1 FROM stripe_events WHERE event_id=?").get(eventId),
  );
}

export async function billingCatalog(
  locale: "en" | "zh-CN",
): Promise<BillingCatalogEntry[]> {
  const entries: BillingCatalogEntry[] = [];
  const language = locale === "en" ? "en" : "zh";
  if (billingProvider() === "gumroad") {
    for (const key of ["salon_pro"] as PlanKey[]) {
      const productId = gumroadProductId(key);
      if (!productId) continue;
      entries.push({
        key,
        name: BILLING_PLANS[key].name[language],
        quota: BILLING_PLANS[key].quota,
        productId,
        priceId: null,
        unitAmount: gumroadMonthlyPriceCents(key),
        currency: "usd",
        interval: "month",
        active: true,
        provider: "gumroad" as const,
        checkoutUrl: gumroadCheckoutUrl(key),
      });
    }
    return entries;
  }
  if (billingProvider() === "paddle") {
    for (const key of ["salon_pro"] as PlanKey[]) {
      const price = await paddlePriceDetails(key);
      if (!price) continue;
      entries.push({
        key,
        name: BILLING_PLANS[key].name[language],
        quota: BILLING_PLANS[key].quota,
        productId: null,
        priceId: price.priceId,
        unitAmount: price.unitAmount,
        currency: price.currency,
        interval: price.interval,
        active: true,
        provider: "paddle",
        checkoutUrl: null,
      });
    }
    return entries;
  }
  const stripe = stripeClient();
  for (const key of ["salon_pro"] as PlanKey[]) {
    const priceId = planPriceId(key);
    if (!priceId) continue;
    const price = await stripe.prices.retrieve(priceId, {
      expand: ["product"],
    });
    if (!price.active || price.currency !== "usd" || !price.recurring) continue;
    entries.push({
      key,
      name: BILLING_PLANS[key].name[language],
      quota: BILLING_PLANS[key].quota,
      priceId,
      unitAmount: price.unit_amount,
      currency: price.currency,
      interval: price.recurring.interval,
      active: price.active,
      productId: null,
      provider: "stripe" as const,
      checkoutUrl: null,
    });
  }
  return entries;
}
