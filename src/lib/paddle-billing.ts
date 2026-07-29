import { Environment, Paddle } from "@paddle/paddle-node-sdk";
import type { AuthUser } from "./database";
import { db, getAuthUserById } from "./database";

export type PaddlePurchaseKey = "personal_pack" | "personal_plus" | "salon_pro";

const PURCHASES: Record<PaddlePurchaseKey, { env: string; recurring: boolean }> = {
  personal_pack: { env: "PADDLE_PERSONAL_PACK_PRICE_ID", recurring: false },
  personal_plus: { env: "PADDLE_PERSONAL_PLUS_PRICE_ID", recurring: true },
  salon_pro: { env: "PADDLE_SALON_PRO_PRICE_ID", recurring: true },
};

let client: Paddle | undefined;
export function paddleClient() {
  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey) throw new Error("PADDLE_NOT_CONFIGURED");
  client ??= new Paddle(apiKey, {
    environment:
      process.env.PADDLE_ENVIRONMENT === "production"
        ? Environment.production
        : Environment.sandbox,
  });
  return client;
}

export function resetPaddleClientForTest() {
  if (process.env.NODE_ENV !== "test") throw new Error("TEST_ONLY");
  client = undefined;
}

export function paddlePriceId(key: PaddlePurchaseKey) {
  return process.env[PURCHASES[key].env] ?? null;
}

export function paddlePurchaseForPrice(priceId: string) {
  return (
    (Object.keys(PURCHASES) as PaddlePurchaseKey[]).find(
      (key) => paddlePriceId(key) === priceId,
    ) ?? null
  );
}

export function paddlePurchaseAllowed(user: AuthUser, key: PaddlePurchaseKey) {
  return key === "salon_pro"
    ? user.role === "store_owner"
    : user.role === "personal";
}

export async function paddlePriceDetails(key: PaddlePurchaseKey) {
  const priceId = paddlePriceId(key);
  if (!priceId) return null;
  const price = await paddleClient().prices.get(priceId);
  if (price.status !== "active" || price.unitPrice.currencyCode !== "USD")
    throw new Error("BILLING_PRICE_INVALID");
  if (PURCHASES[key].recurring !== Boolean(price.billingCycle))
    throw new Error("BILLING_PRICE_INVALID");
  return {
    priceId,
    unitAmount: Number(price.unitPrice.amount),
    currency: price.unitPrice.currencyCode.toLowerCase(),
    interval: price.billingCycle?.interval ?? null,
  };
}

export async function getOrCreatePaddleCustomer(user: AuthUser) {
  const existing = db()
    .prepare("SELECT customer_id FROM paddle_customers WHERE user_id=?")
    .get(user.id) as { customer_id?: string } | undefined;
  if (existing?.customer_id) return existing.customer_id;
  if (!user.email) throw new Error("BILLING_EMAIL_REQUIRED");
  const customer = await paddleClient().customers.create({
    email: user.email,
    name: user.name,
    customData: { userId: user.id },
  });
  const now = new Date().toISOString();
  db()
    .prepare(
      `INSERT INTO paddle_customers(user_id,customer_id,created_at,updated_at)
       VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET
       customer_id=excluded.customer_id,updated_at=excluded.updated_at`,
    )
    .run(user.id, customer.id, now, now);
  return customer.id;
}

export async function createPaddleTransaction(
  user: AuthUser,
  purchaseKey: PaddlePurchaseKey,
) {
  const priceId = paddlePriceId(purchaseKey);
  if (!priceId) throw new Error("BILLING_NOT_CONFIGURED");
  const customerId = await getOrCreatePaddleCustomer(user);
  return paddleClient().transactions.create({
    items: [{ priceId, quantity: 1 }],
    customerId,
    collectionMode: "automatic",
    customData: { userId: user.id, planCode: purchaseKey },
  });
}

type CustomData = Record<string, unknown> | null;
type TransactionLike = {
  id: string;
  status: string;
  customerId: string | null;
  subscriptionId: string | null;
  invoiceNumber: string | null;
  currencyCode: string;
  customData: CustomData;
  items: Array<{ price?: { id?: string } | null }>;
  details?: { totals?: { total?: string } | null } | null;
  billedAt: string | null;
  createdAt: string;
};
type SubscriptionLike = {
  id: string;
  status: string;
  customerId: string;
  customData: CustomData;
  items: Array<{ price?: { id?: string } | null }>;
  currentBillingPeriod?: { startsAt?: string; endsAt?: string } | null;
  nextBilledAt: string | null;
  scheduledChange?: { action?: string } | null;
  createdAt: string;
};
type AdjustmentLike = {
  transactionId: string;
  action: string;
  status: string;
};

function metadata(data: CustomData) {
  return {
    userId: typeof data?.userId === "string" ? data.userId : null,
    planCode: typeof data?.planCode === "string" ? data.planCode : null,
  };
}

function requirePurchase(input: TransactionLike | SubscriptionLike) {
  const meta = metadata(input.customData);
  const priceId = input.items[0]?.price?.id ?? null;
  const purchaseKey =
    meta.planCode && meta.planCode in PURCHASES
      ? (meta.planCode as PaddlePurchaseKey)
      : priceId
        ? paddlePurchaseForPrice(priceId)
        : null;
  if (!meta.userId || !priceId || !purchaseKey)
    throw new Error("PADDLE_METADATA_MISSING");
  const user = getAuthUserById(meta.userId);
  if (!user || !paddlePurchaseAllowed(user, purchaseKey))
    throw new Error("PADDLE_PURCHASE_NOT_ALLOWED");
  if (paddlePriceId(purchaseKey) !== priceId)
    throw new Error("PADDLE_PRICE_MISMATCH");
  return { user, userId: user.id, priceId, purchaseKey };
}

export function syncPaddleTransaction(transaction: TransactionLike) {
  if (transaction.status !== "completed") throw new Error("PADDLE_NOT_COMPLETED");
  const { userId, priceId, purchaseKey } = requirePurchase(transaction);
  const database = db();
  const now = new Date().toISOString();
  database.exec("BEGIN IMMEDIATE");
  try {
    const inserted = database
      .prepare(
        `INSERT OR IGNORE INTO paddle_transactions
         (transaction_id,user_id,customer_id,subscription_id,purchase_key,price_id,status,currency_code,total_amount,credited_sets,reversed,invoice_number,billed_at,created_at,updated_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        transaction.id,
        userId,
        transaction.customerId,
        transaction.subscriptionId,
        purchaseKey,
        priceId,
        transaction.status,
        transaction.currencyCode,
        Number(transaction.details?.totals?.total ?? 0),
        purchaseKey === "personal_pack"
          ? Math.max(1, Number(process.env.PERSONAL_PACK_SETS) || 5)
          : 0,
        0,
        transaction.invoiceNumber,
        transaction.billedAt,
        transaction.createdAt || now,
        now,
      );
    if (inserted.changes && purchaseKey === "personal_pack") {
      const sets = Math.max(1, Number(process.env.PERSONAL_PACK_SETS) || 5);
      const ownerKey = `user:${userId}`;
      database
        .prepare(
          `INSERT OR IGNORE INTO generation_wallets
           (owner_key,user_id,trial_used,trial_reserved,credit_sets,credit_reserved,updated_at)
           VALUES(?,?,0,0,0,0,?)`,
        )
        .run(ownerKey, userId, now);
      database
        .prepare(
          "UPDATE generation_wallets SET credit_sets=credit_sets+?,updated_at=? WHERE owner_key=?",
        )
        .run(sets, now, ownerKey);
    }
    if (transaction.customerId)
      database
        .prepare(
          `INSERT INTO paddle_customers(user_id,customer_id,created_at,updated_at)
           VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET
           customer_id=excluded.customer_id,updated_at=excluded.updated_at`,
        )
        .run(userId, transaction.customerId, now, now);
    database.exec("COMMIT");
    return { userId, purchaseKey, created: Boolean(inserted.changes) };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function syncPaddleAdjustment(adjustment: AdjustmentLike) {
  if (adjustment.status !== "approved" || adjustment.action !== "refund")
    return { changed: false };
  const database = db();
  const row = database
    .prepare(
      "SELECT user_id,purchase_key,credited_sets,reversed FROM paddle_transactions WHERE transaction_id=?",
    )
    .get(adjustment.transactionId) as
    | { user_id: string; purchase_key: string; credited_sets: number; reversed: number }
    | undefined;
  if (!row || row.reversed) return { changed: false };
  const now = new Date().toISOString();
  database.exec("BEGIN IMMEDIATE");
  try {
    const updated = database
      .prepare(
        "UPDATE paddle_transactions SET status='refunded',reversed=1,updated_at=? WHERE transaction_id=? AND reversed=0",
      )
      .run(now, adjustment.transactionId);
    if (updated.changes && row.purchase_key === "personal_pack")
      database
        .prepare(
          `UPDATE generation_wallets SET
           credit_sets=MAX(credit_reserved,credit_sets-?),updated_at=? WHERE owner_key=?`,
        )
        .run(row.credited_sets, now, `user:${row.user_id}`);
    database.exec("COMMIT");
    return { changed: Boolean(updated.changes) };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function syncPaddleSubscription(subscription: SubscriptionLike) {
  const { userId, priceId, purchaseKey } = requirePurchase(subscription);
  if (purchaseKey === "personal_pack") throw new Error("PADDLE_PLAN_INVALID");
  const now = new Date().toISOString();
  const startsAt = subscription.currentBillingPeriod?.startsAt;
  const cancelAtPeriodEnd = subscription.scheduledChange?.action === "cancel";
  db()
    .prepare(
      `INSERT INTO paddle_subscriptions
       (subscription_id,user_id,customer_id,plan_key,price_id,status,current_period_start,next_billed_at,cancel_at_period_end,scheduled_change_json,created_at,updated_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(subscription_id) DO UPDATE SET
       customer_id=excluded.customer_id,plan_key=excluded.plan_key,price_id=excluded.price_id,
       status=excluded.status,current_period_start=excluded.current_period_start,
       next_billed_at=excluded.next_billed_at,cancel_at_period_end=excluded.cancel_at_period_end,
       scheduled_change_json=excluded.scheduled_change_json,updated_at=excluded.updated_at`,
    )
    .run(
      subscription.id,
      userId,
      subscription.customerId,
      purchaseKey,
      priceId,
      subscription.status,
      startsAt ? Date.parse(startsAt) : null,
      subscription.nextBilledAt ? Date.parse(subscription.nextBilledAt) : null,
      cancelAtPeriodEnd ? 1 : 0,
      subscription.scheduledChange
        ? JSON.stringify(subscription.scheduledChange)
        : null,
      subscription.createdAt || now,
      now,
    );
  return { userId, planKey: purchaseKey, status: subscription.status };
}

export function claimPaddleEvent(eventId: string, eventType: string) {
  const existing = db()
    .prepare("SELECT status FROM paddle_events WHERE event_id=?")
    .get(eventId) as { status?: string } | undefined;
  if (existing?.status === "processed" || existing?.status === "processing")
    return false;
  const now = new Date().toISOString();
  if (existing?.status === "failed") {
    db()
      .prepare(
        "UPDATE paddle_events SET status='processing',attempts=attempts+1,last_error=NULL WHERE event_id=?",
      )
      .run(eventId);
    return true;
  }
  const result = db()
    .prepare(
      `INSERT OR IGNORE INTO paddle_events
       (event_id,event_type,status,attempts,received_at) VALUES(?,?,'processing',1,?)`,
    )
    .run(eventId, eventType, now);
  return Boolean(result.changes);
}

export function finishPaddleEvent(eventId: string) {
  db()
    .prepare(
      "UPDATE paddle_events SET status='processed',processed_at=?,last_error=NULL WHERE event_id=?",
    )
    .run(new Date().toISOString(), eventId);
}

export function failPaddleEvent(eventId: string, error: unknown) {
  db()
    .prepare(
      "UPDATE paddle_events SET status='failed',last_error=? WHERE event_id=?",
    )
    .run(error instanceof Error ? error.message.slice(0, 500) : "UNKNOWN", eventId);
}

export function listPaddleTransactions(userId: string) {
  return db()
    .prepare(
      `SELECT transaction_id,purchase_key,status,currency_code,total_amount,
       invoice_number,billed_at FROM paddle_transactions WHERE user_id=?
       ORDER BY COALESCE(billed_at,created_at) DESC LIMIT 50`,
    )
    .all(userId) as Array<Record<string, unknown>>;
}
