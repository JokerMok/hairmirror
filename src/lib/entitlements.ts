import type { AuthUser } from "./database";
import { db } from "./database";
import { quotaForUser } from "./model-operations";

type WalletRow = {
  owner_key: string;
  user_id: string | null;
  trial_used: number;
  trial_reserved: number;
  credit_sets: number;
  credit_reserved: number;
};

export type AccessSummary =
  | {
      kind: "anonymous";
      requiresLogin: true;
    }
  | {
      kind: "personal";
      trialAvailable: boolean;
      creditSets: number;
      reservedSets: number;
    }
  | {
      kind: "salon";
      remainingSets: number;
      limitSets: number;
      usedSets: number;
      period: string;
    };

const walletKey = (user: AuthUser | null, sessionId: string) =>
  user ? `user:${user.id}` : `session:${sessionId}`;

function ensureWallet(ownerKey: string, userId: string | null) {
  const now = new Date().toISOString();
  db()
    .prepare(
      "INSERT OR IGNORE INTO generation_wallets(owner_key,user_id,trial_used,trial_reserved,credit_sets,credit_reserved,updated_at) VALUES(?,?,0,0,0,0,?)",
    )
    .run(ownerKey, userId, now);
  return db()
    .prepare("SELECT * FROM generation_wallets WHERE owner_key=?")
    .get(ownerKey) as WalletRow;
}

function reserveWalletAccess(
  jobId: string,
  ownerKey: string,
  userId: string | null,
  now: string,
) {
  const wallet = ensureWallet(ownerKey, userId);
  let source: "trial" | "pack";
  if (!wallet.trial_used && !wallet.trial_reserved) {
    db()
      .prepare(
        "UPDATE generation_wallets SET trial_reserved=1,updated_at=? WHERE owner_key=?",
      )
      .run(now, ownerKey);
    source = "trial";
  } else if (wallet.credit_sets - wallet.credit_reserved > 0) {
    db()
      .prepare(
        "UPDATE generation_wallets SET credit_reserved=credit_reserved+1,updated_at=? WHERE owner_key=?",
      )
      .run(now, ownerKey);
    source = "pack";
  } else {
    throw new Error("ACCESS_REQUIRED");
  }
  db()
    .prepare(
      `INSERT INTO generation_access_charges(job_id,owner_key,source,quota_user_id,quota_period,quota_units,status,created_at,updated_at)
       VALUES(?,?,?,NULL,NULL,0,'reserved',?,?)
       ON CONFLICT(job_id) DO UPDATE SET owner_key=excluded.owner_key,source=excluded.source,quota_user_id=NULL,quota_period=NULL,quota_units=0,status='reserved',updated_at=excluded.updated_at`,
    )
    .run(jobId, ownerKey, source, now, now);
}

export function reserveGenerationAccess(input: {
  jobId: string;
  user: AuthUser | null;
  sessionId: string;
  variantCount: number;
  now?: string;
}) {
  const now = input.now ?? new Date().toISOString();
  if (!input.user) throw new Error("AUTH_REQUIRED");
  const quota = quotaForUser(input.user);
  if (quota.remaining >= input.variantCount) {
    const reserved = db()
      .prepare(
        "UPDATE usage_quotas SET reserved_count=reserved_count+?,updated_at=? WHERE user_id=? AND period=? AND used_count+reserved_count+?<=limit_count",
      )
      .run(
        input.variantCount,
        now,
        quota.ownerUserId,
        quota.period,
        input.variantCount,
      );
    if (!reserved.changes) throw new Error("ACCESS_REQUIRED");
    db()
      .prepare(
        `INSERT INTO generation_access_charges(job_id,owner_key,source,quota_user_id,quota_period,quota_units,status,created_at,updated_at)
         VALUES(?,?,'subscription',?,?,?,'reserved',?,?)
         ON CONFLICT(job_id) DO UPDATE SET owner_key=excluded.owner_key,source='subscription',quota_user_id=excluded.quota_user_id,quota_period=excluded.quota_period,quota_units=excluded.quota_units,status='reserved',updated_at=excluded.updated_at`,
      )
      .run(
        input.jobId,
        `user:${input.user.id}`,
        quota.ownerUserId,
        quota.period,
        input.variantCount,
        now,
        now,
      );
    return "subscription" as const;
  }
  if (input.user.role === "staff") throw new Error("ACCESS_REQUIRED");
  const ownerKey = walletKey(input.user, input.sessionId);
  reserveWalletAccess(input.jobId, ownerKey, input.user.id, now);
  return "wallet" as const;
}

export function finalizeGenerationAccess(jobId: string, consumed: boolean) {
  const database = db();
  const charge = database
    .prepare("SELECT * FROM generation_access_charges WHERE job_id=?")
    .get(jobId) as Record<string, unknown> | undefined;
  if (!charge || charge.status !== "reserved") return false;
  const now = new Date().toISOString();
  const source = String(charge.source);
  if (source === "subscription") {
    database
      .prepare(
        `UPDATE usage_quotas SET reserved_count=MAX(0,reserved_count-?),used_count=used_count+?,updated_at=?
         WHERE user_id=? AND period=?`,
      )
      .run(
        Number(charge.quota_units),
        consumed ? Number(charge.quota_units) : 0,
        now,
        String(charge.quota_user_id),
        String(charge.quota_period),
      );
  } else if (source === "pack") {
    database
      .prepare(
        `UPDATE generation_wallets SET credit_reserved=MAX(0,credit_reserved-1),
         credit_sets=MAX(0,credit_sets-?),updated_at=? WHERE owner_key=?`,
      )
      .run(consumed ? 1 : 0, now, String(charge.owner_key));
  } else {
    database
      .prepare(
        `UPDATE generation_wallets SET trial_reserved=0,
         trial_used=CASE WHEN ? THEN 1 ELSE trial_used END,updated_at=? WHERE owner_key=?`,
      )
      .run(consumed ? 1 : 0, now, String(charge.owner_key));
  }
  database
    .prepare(
      "UPDATE generation_access_charges SET status=?,updated_at=? WHERE job_id=? AND status='reserved'",
    )
    .run(consumed ? "consumed" : "released", now, jobId);
  return true;
}

export function accessSummary(
  user: AuthUser,
  sessionId: string,
): Exclude<AccessSummary, { kind: "anonymous" }>;
export function accessSummary(
  user: null,
  sessionId: string,
): Extract<AccessSummary, { kind: "anonymous" }>;
export function accessSummary(
  user: AuthUser | null,
  sessionId: string,
): AccessSummary;
export function accessSummary(user: AuthUser | null, sessionId: string): AccessSummary {
  if (!user) return { kind: "anonymous", requiresLogin: true };
  const quota = quotaForUser(user);
  if (quota.limit > 0)
    return {
      kind: "salon",
      remainingSets: Math.floor(quota.remaining / 3),
      limitSets: Math.floor(quota.limit / 3),
      usedSets: Math.floor(quota.used / 3),
      period: quota.period,
    };
  const ownerKey = walletKey(user, sessionId);
  const wallet = db()
    .prepare("SELECT * FROM generation_wallets WHERE owner_key=?")
    .get(ownerKey) as WalletRow | undefined;
  return {
    kind: "personal",
    trialAvailable: !wallet?.trial_used && !wallet?.trial_reserved,
    creditSets: Math.max(0, Number(wallet?.credit_sets ?? 0) - Number(wallet?.credit_reserved ?? 0)),
    reservedSets: Number(wallet?.credit_reserved ?? 0),
  };
}
