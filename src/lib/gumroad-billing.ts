import { createHash } from "node:crypto";
import type { PlanKey } from "./billing";
import type { AuthUser } from "./database";
import { db, getAuthUserById } from "./database";
import {
  decryptBillingSecret,
  encryptBillingSecret,
} from "./billing-vault";

type GumroadPurchase = {
  product_id?: string;
  email?: string;
  currency?: string;
  subscription_id?: string;
  sale_id?: string;
  id?: string;
  recurrence?: string;
  refunded?: boolean;
  disputed?: boolean;
  dispute_won?: boolean;
  chargebacked?: boolean;
  subscription_ended_at?: string | null;
  subscription_cancelled_at?: string | null;
  subscription_failed_at?: string | null;
};

type GumroadVerifyResponse = {
  success?: boolean;
  purchase?: GumroadPurchase;
};

type GumroadLicenseRow = {
  user_id: string;
  plan_key: PlanKey;
  product_id: string;
  encrypted_license_key: string;
  license_fingerprint: string;
  subscription_id: string;
  sale_id: string | null;
  purchase_email: string;
  recurrence: string;
  status: string;
  access_until: number | null;
  cancel_at_period_end: number;
  last_verified_at: number;
  verification_error: string | null;
  created_at: string;
  updated_at: string;
};

const VERIFY_URL = "https://api.gumroad.com/v2/licenses/verify";

function positiveMs(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function gumroadProductId(plan: PlanKey) {
  return plan === "personal_plus"
    ? process.env.GUMROAD_PERSONAL_PRODUCT_ID ?? null
    : process.env.GUMROAD_SALON_PRODUCT_ID ?? null;
}

export function gumroadCheckoutUrl(plan: PlanKey) {
  return plan === "personal_plus"
    ? process.env.GUMROAD_PERSONAL_CHECKOUT_URL ?? null
    : process.env.GUMROAD_SALON_CHECKOUT_URL ?? null;
}

export function gumroadPersonalPackProductId() {
  return process.env.GUMROAD_PERSONAL_PACK_PRODUCT_ID ?? null;
}

export function gumroadPersonalPackCheckoutUrl() {
  return process.env.GUMROAD_PERSONAL_PACK_CHECKOUT_URL ?? null;
}

export function personalPackSetCount() {
  const parsed = Number(process.env.PERSONAL_PACK_SETS);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 5;
}

function parseTimestamp(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function purchaseState(purchase: GumroadPurchase, now: number) {
  if (purchase.refunded) return { status: "refunded", accessUntil: null };
  if (purchase.chargebacked)
    return { status: "chargebacked", accessUntil: null };
  if (purchase.disputed && !purchase.dispute_won)
    return { status: "disputed", accessUntil: null };

  const endDates = [
    purchase.subscription_ended_at,
    purchase.subscription_cancelled_at,
    purchase.subscription_failed_at,
  ]
    .map(parseTimestamp)
    .filter((value): value is number => value !== null);
  const accessUntil = endDates.length ? Math.min(...endDates) : null;
  if (accessUntil !== null && accessUntil <= now)
    return { status: "ended", accessUntil };
  return { status: "active", accessUntil };
}

function fingerprint(licenseKey: string) {
  return createHash("sha256").update(licenseKey).digest("hex");
}

export async function verifyGumroadLicense(input: {
  plan: PlanKey;
  licenseKey: string;
  expectedEmail: string;
  now?: number;
}) {
  const productId = gumroadProductId(input.plan);
  if (!productId) throw new Error("GUMROAD_PRODUCT_NOT_CONFIGURED");
  const body = new URLSearchParams({
    product_id: productId,
    license_key: input.licenseKey,
    increment_uses_count: "false",
  });
  let response: Response;
  try {
    response = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(
        positiveMs(process.env.GUMROAD_VERIFY_TIMEOUT_MS, 10_000),
      ),
    });
  } catch {
    throw new Error("GUMROAD_UNAVAILABLE");
  }
  const payload = (await response.json().catch(() => null)) as
    | GumroadVerifyResponse
    | null;
  if (!response.ok || !payload?.success || !payload.purchase)
    throw new Error("INVALID_LICENSE");
  const purchase = payload.purchase;
  if (purchase.product_id !== productId)
    throw new Error("PRODUCT_MISMATCH");
  if (
    !purchase.email ||
    purchase.email.trim().toLowerCase() !==
      input.expectedEmail.trim().toLowerCase()
  )
    throw new Error("EMAIL_MISMATCH");
  if (purchase.currency?.toLowerCase() !== "usd")
    throw new Error("CURRENCY_MISMATCH");
  if (!purchase.subscription_id || !purchase.recurrence)
    throw new Error("SUBSCRIPTION_REQUIRED");
  const now = input.now ?? Date.now();
  const state = purchaseState(purchase, now);
  return {
    productId,
    subscriptionId: purchase.subscription_id,
    saleId: purchase.sale_id ?? purchase.id ?? null,
    purchaseEmail: purchase.email.trim().toLowerCase(),
    recurrence: purchase.recurrence,
    status: state.status,
    accessUntil: state.accessUntil,
    cancelAtPeriodEnd:
      state.status === "active" && state.accessUntil !== null,
    verifiedAt: now,
  };
}

export async function verifyGumroadPack(input: {
  licenseKey: string;
  expectedEmail: string;
  now?: number;
}) {
  const productId = gumroadPersonalPackProductId();
  if (!productId) throw new Error("GUMROAD_PRODUCT_NOT_CONFIGURED");
  const body = new URLSearchParams({
    product_id: productId,
    license_key: input.licenseKey,
    increment_uses_count: "false",
  });
  let response: Response;
  try {
    response = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(
        positiveMs(process.env.GUMROAD_VERIFY_TIMEOUT_MS, 10_000),
      ),
    });
  } catch {
    throw new Error("GUMROAD_UNAVAILABLE");
  }
  const payload = (await response.json().catch(() => null)) as GumroadVerifyResponse | null;
  if (!response.ok || !payload?.success || !payload.purchase)
    throw new Error("INVALID_LICENSE");
  const purchase = payload.purchase;
  if (purchase.product_id !== productId) throw new Error("PRODUCT_MISMATCH");
  if (
    !purchase.email ||
    purchase.email.trim().toLowerCase() !== input.expectedEmail.trim().toLowerCase()
  )
    throw new Error("EMAIL_MISMATCH");
  if (purchase.currency?.toLowerCase() !== "usd")
    throw new Error("CURRENCY_MISMATCH");
  const saleId = purchase.sale_id ?? purchase.id;
  if (!saleId) throw new Error("INVALID_LICENSE");
  const state = purchaseState(purchase, input.now ?? Date.now());
  if (state.status !== "active") throw new Error("LICENSE_INACTIVE");
  return {
    productId,
    saleId,
    purchaseEmail: purchase.email.trim().toLowerCase(),
  };
}

export async function activateGumroadPack(
  user: AuthUser,
  licenseKey: string,
) {
  if (!user.email) throw new Error("EMAIL_REQUIRED");
  if (user.role !== "personal") throw new Error("PLAN_NOT_ALLOWED");
  const verified = await verifyGumroadPack({
    licenseKey,
    expectedEmail: user.email,
  });
  const setCount = personalPackSetCount();
  const licenseFingerprint = fingerprint(licenseKey);
  const database = db();
  const existing = database
    .prepare(
      "SELECT user_id FROM gumroad_pack_grants WHERE sale_id=? OR license_fingerprint=?",
    )
    .get(verified.saleId, licenseFingerprint) as
    | { user_id: string }
    | undefined;
  if (existing?.user_id !== undefined && existing.user_id !== user.id)
    throw new Error("LICENSE_ALREADY_BOUND");
  let granted = false;
  if (!existing) {
    const now = new Date().toISOString();
    const ownerKey = `user:${user.id}`;
    database.exec("BEGIN IMMEDIATE");
    try {
      database
        .prepare(
          "INSERT OR IGNORE INTO generation_wallets(owner_key,user_id,trial_used,trial_reserved,credit_sets,credit_reserved,updated_at) VALUES(?,?,0,0,0,0,?)",
        )
        .run(ownerKey, user.id, now);
      database
        .prepare(
          "INSERT INTO gumroad_pack_grants(sale_id,user_id,product_id,license_fingerprint,purchase_email,set_count,created_at) VALUES(?,?,?,?,?,?,?)",
        )
        .run(
          verified.saleId,
          user.id,
          verified.productId,
          licenseFingerprint,
          verified.purchaseEmail,
          setCount,
          now,
        );
      database
        .prepare(
          "UPDATE generation_wallets SET credit_sets=credit_sets+?,updated_at=? WHERE owner_key=?",
        )
        .run(setCount, now, ownerKey);
      database.exec("COMMIT");
      granted = true;
    } catch (error) {
      if (database.isTransaction) database.exec("ROLLBACK");
      if (error instanceof Error && error.message.includes("UNIQUE")) {
        const winner = database
          .prepare(
            "SELECT user_id FROM gumroad_pack_grants WHERE sale_id=? OR license_fingerprint=?",
          )
          .get(verified.saleId, licenseFingerprint) as
          | { user_id: string }
          | undefined;
        if (winner?.user_id === user.id) return { granted: false, setCount };
        throw new Error("LICENSE_ALREADY_BOUND");
      }
      throw error;
    }
  }
  return { granted, setCount };
}

function saveVerifiedLicense(input: {
  userId: string;
  plan: PlanKey;
  licenseKey: string;
  verified: Awaited<ReturnType<typeof verifyGumroadLicense>>;
}) {
  const now = new Date(input.verified.verifiedAt).toISOString();
  try {
    db()
      .prepare(
        `INSERT INTO gumroad_licenses(
          user_id,plan_key,product_id,encrypted_license_key,license_fingerprint,
          subscription_id,sale_id,purchase_email,recurrence,status,access_until,
          cancel_at_period_end,last_verified_at,verification_error,created_at,updated_at
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,NULL,?,?)
        ON CONFLICT(user_id) DO UPDATE SET
          plan_key=excluded.plan_key,product_id=excluded.product_id,
          encrypted_license_key=excluded.encrypted_license_key,
          license_fingerprint=excluded.license_fingerprint,
          subscription_id=excluded.subscription_id,sale_id=excluded.sale_id,
          purchase_email=excluded.purchase_email,recurrence=excluded.recurrence,
          status=excluded.status,access_until=excluded.access_until,
          cancel_at_period_end=excluded.cancel_at_period_end,
          last_verified_at=excluded.last_verified_at,verification_error=NULL,
          updated_at=excluded.updated_at`,
      )
      .run(
        input.userId,
        input.plan,
        input.verified.productId,
        encryptBillingSecret(input.licenseKey),
        fingerprint(input.licenseKey),
        input.verified.subscriptionId,
        input.verified.saleId,
        input.verified.purchaseEmail,
        input.verified.recurrence,
        input.verified.status,
        input.verified.accessUntil,
        input.verified.cancelAtPeriodEnd ? 1 : 0,
        input.verified.verifiedAt,
        now,
        now,
      );
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE"))
      throw new Error("LICENSE_ALREADY_BOUND");
    throw error;
  }
}

export async function activateGumroadLicense(
  user: AuthUser,
  plan: PlanKey,
  licenseKey: string,
  now = Date.now(),
) {
  if (!user.email) throw new Error("EMAIL_REQUIRED");
  const verified = await verifyGumroadLicense({
    plan,
    licenseKey,
    expectedEmail: user.email,
    now,
  });
  if (verified.status !== "active") throw new Error("LICENSE_INACTIVE");
  saveVerifiedLicense({ userId: user.id, plan, licenseKey, verified });
  return gumroadBillingState(user.id, now);
}

export function gumroadBillingState(userId: string, now = Date.now()) {
  const row = db()
    .prepare("SELECT * FROM gumroad_licenses WHERE user_id=?")
    .get(userId) as GumroadLicenseRow | undefined;
  if (!row) return null;
  const graceMs = positiveMs(
    process.env.GUMROAD_VERIFICATION_GRACE_MS,
    72 * 60 * 60 * 1000,
  );
  const stale = now - Number(row.last_verified_at) > graceMs;
  const ended = Boolean(row.access_until && Number(row.access_until) <= now);
  const status = stale
    ? "stale"
    : ended
      ? "ended"
      : String(row.status);
  return {
    provider: "gumroad" as const,
    planKey: row.plan_key,
    status,
    periodEnd: row.access_until ? Number(row.access_until) : null,
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end) && !ended,
    customerId: null,
    lastVerifiedAt: Number(row.last_verified_at),
    verificationError: row.verification_error,
  };
}

export async function refreshGumroadLicense(
  userId: string,
  options: { force?: boolean; now?: number } = {},
) {
  const row = db()
    .prepare("SELECT * FROM gumroad_licenses WHERE user_id=?")
    .get(userId) as GumroadLicenseRow | undefined;
  if (!row) return null;
  const now = options.now ?? Date.now();
  const interval = positiveMs(
    process.env.GUMROAD_REFRESH_INTERVAL_MS,
    6 * 60 * 60 * 1000,
  );
  if (!options.force && now - Number(row.last_verified_at) < interval)
    return gumroadBillingState(userId, now);
  const user = getAuthUserById(userId);
  if (!user?.email) return gumroadBillingState(userId, now);
  try {
    const licenseKey = decryptBillingSecret(row.encrypted_license_key);
    const verified = await verifyGumroadLicense({
      plan: row.plan_key,
      licenseKey,
      expectedEmail: user.email,
      now,
    });
    saveVerifiedLicense({ userId, plan: row.plan_key, licenseKey, verified });
  } catch (error) {
    const code = error instanceof Error ? error.message : "VERIFICATION_FAILED";
    const unavailable = code === "GUMROAD_UNAVAILABLE";
    db()
      .prepare(
        `UPDATE gumroad_licenses SET
          verification_error=?,
          status=CASE WHEN ? THEN status ELSE 'invalid' END,
          last_verified_at=CASE WHEN ? THEN last_verified_at ELSE ? END,
          updated_at=? WHERE user_id=?`,
      )
      .run(
        code,
        unavailable ? 1 : 0,
        unavailable ? 1 : 0,
        now,
        new Date(now).toISOString(),
        userId,
      );
  }
  return gumroadBillingState(userId, now);
}

export async function refreshDueGumroadLicenses(limit = 20) {
  const interval = positiveMs(
    process.env.GUMROAD_REFRESH_INTERVAL_MS,
    6 * 60 * 60 * 1000,
  );
  const rows = db()
    .prepare(
      "SELECT user_id FROM gumroad_licenses WHERE last_verified_at<=? ORDER BY last_verified_at LIMIT ?",
    )
    .all(Date.now() - interval, limit) as Array<{ user_id: string }>;
  const results = await Promise.allSettled(
    rows.map((row) => refreshGumroadLicense(row.user_id, { force: true })),
  );
  return {
    checked: rows.length,
    failed: results.filter((result) => result.status === "rejected").length,
  };
}
