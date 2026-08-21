import type { AuthUser } from "./database";
import { db, getAuthUserById } from "./database";
import { decryptSecret, encryptSecret, maskSecret } from "./secret-vault";
import { entitledQuota } from "./billing";

export type ModelConfigInput = {
  name: string;
  provider: string;
  model: string;
  endpoint?: string;
  apiKey?: string;
  enabled: boolean;
  priority: number;
  timeoutMs: number;
  costPerImageMicros: number;
  currency: string;
};
export type ModelRuntime = ReturnType<typeof publicConfig> & {
  apiKey: string | null;
};
type ModelRow = Record<string, unknown>;
const ROLE_LIMITS: Record<AuthUser["role"], number> = {
  personal: 0,
  store_owner: 0,
  staff: 0,
};

function publicConfig(row: ModelRow) {
  let apiKeyMasked: string | null = null;
  if (row.encrypted_api_key)
    apiKeyMasked = maskSecret(decryptSecret(String(row.encrypted_api_key)));
  return {
    id: String(row.id),
    name: String(row.name),
    provider: String(row.provider),
    model: String(row.model),
    endpoint: row.endpoint ? String(row.endpoint) : "",
    hasApiKey: Boolean(row.encrypted_api_key),
    apiKeyMasked,
    enabled: Boolean(row.enabled),
    priority: Number(row.priority),
    timeoutMs: Number(row.timeout_ms),
    costPerImageMicros: Number(row.cost_per_image_micros),
    currency: String(row.currency),
    updatedAt: String(row.updated_at),
  };
}

export function listModelConfigs() {
  return (
    db()
      .prepare("SELECT * FROM model_configs ORDER BY priority,created_at")
      .all() as ModelRow[]
  ).map(publicConfig);
}

export function getActiveModelConfig() {
  const row = db()
    .prepare(
      "SELECT * FROM model_configs WHERE enabled=1 ORDER BY priority,created_at LIMIT 1",
    )
    .get() as ModelRow | undefined;
  return row ? publicConfig(row) : null;
}

export function getActiveModelSecret() {
  const row = db()
    .prepare(
      "SELECT encrypted_api_key FROM model_configs WHERE enabled=1 ORDER BY priority,created_at LIMIT 1",
    )
    .get() as { encrypted_api_key?: string } | undefined;
  return row?.encrypted_api_key ? decryptSecret(row.encrypted_api_key) : null;
}

export function getActiveModelRuntime() {
  const row = db()
    .prepare(
      "SELECT * FROM model_configs WHERE enabled=1 ORDER BY priority,created_at LIMIT 1",
    )
    .get() as ModelRow | undefined;
  if (!row) return null;
  return {
    ...publicConfig(row),
    apiKey: row.encrypted_api_key
      ? decryptSecret(String(row.encrypted_api_key))
      : null,
  };
}

export function getModelRuntimeById(id: string): ModelRuntime | null {
  const row = db().prepare("SELECT * FROM model_configs WHERE id=?").get(id) as
    | ModelRow
    | undefined;
  if (!row) return null;
  return {
    ...publicConfig(row),
    apiKey: row.encrypted_api_key
      ? decryptSecret(String(row.encrypted_api_key))
      : null,
  };
}

export function saveModelConfig(input: ModelConfigInput) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const database = db();
  database.exec("BEGIN IMMEDIATE");
  try {
    database
      .prepare(
        `INSERT INTO model_configs(id,name,provider,model,endpoint,encrypted_api_key,enabled,priority,timeout_ms,cost_per_image_micros,currency,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        id,
        input.name,
        input.provider,
        input.model,
        input.endpoint || null,
        input.apiKey ? encryptSecret(input.apiKey) : null,
        input.enabled ? 1 : 0,
        input.priority,
        input.timeoutMs,
        input.costPerImageMicros,
        input.currency,
        now,
        now,
      );
    recordAdminAudit("model.created", "model_config", id, {
      provider: input.provider,
      model: input.model,
      enabled: input.enabled,
    });
    database.exec("COMMIT");
    return id;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function setModelEnabled(id: string, enabled: boolean) {
  const database = db();
  database.exec("BEGIN IMMEDIATE");
  try {
    const changed =
      database
        .prepare("UPDATE model_configs SET enabled=?,updated_at=? WHERE id=?")
        .run(enabled ? 1 : 0, new Date().toISOString(), id).changes > 0;
    if (changed)
      recordAdminAudit("model.enabled", "model_config", id, { enabled });
    database.exec("COMMIT");
    return changed;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function updateModelRuntime(
  id: string,
  input: {
    apiKey?: string;
    enabled: boolean;
    priority: number;
    timeoutMs: number;
    costPerImageMicros: number;
    currency: string;
  },
) {
  const database = db();
  const existing = database
    .prepare("SELECT encrypted_api_key FROM model_configs WHERE id=?")
    .get(id) as { encrypted_api_key?: string } | undefined;
  if (!existing) return false;
  const encrypted = input.apiKey
    ? encryptSecret(input.apiKey)
    : (existing.encrypted_api_key ?? null);
  database.exec("BEGIN IMMEDIATE");
  try {
    const changed =
      database
        .prepare(
          "UPDATE model_configs SET encrypted_api_key=?,enabled=?,priority=?,timeout_ms=?,cost_per_image_micros=?,currency=?,updated_at=? WHERE id=?",
        )
        .run(
          encrypted,
          input.enabled ? 1 : 0,
          input.priority,
          input.timeoutMs,
          input.costPerImageMicros,
          input.currency,
          new Date().toISOString(),
          id,
        ).changes > 0;
    if (changed)
      recordAdminAudit("model.updated", "model_config", id, {
        enabled: input.enabled,
        priority: input.priority,
        timeoutMs: input.timeoutMs,
        costPerImageMicros: input.costPerImageMicros,
        currency: input.currency,
        apiKeyChanged: Boolean(input.apiKey),
      });
    database.exec("COMMIT");
    return changed;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function currentPeriod(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function recordAdminAudit(
  action: string,
  resourceType: string,
  resourceId: string,
  details: Record<string, unknown> = {},
) {
  db()
    .prepare(
      "INSERT INTO audit_logs(id,actor_type,action,resource_type,resource_id,details_json,created_at) VALUES(?,'admin',?,?,?,?,?)",
    )
    .run(
      crypto.randomUUID(),
      action,
      resourceType,
      resourceId,
      JSON.stringify(details),
      new Date().toISOString(),
    );
}

export function listAdminAuditLogs() {
  return db()
    .prepare("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100")
    .all() as ModelRow[];
}

export function listUserQuotas() {
  const users = db()
    .prepare("SELECT id FROM users ORDER BY created_at DESC LIMIT 100")
    .all() as Array<{ id: string }>;
  for (const item of users) {
    const user = getAuthUserById(String(item.id));
    if (user) quotaForUser(user);
  }
  return db()
    .prepare(
      `SELECT u.id,u.phone,u.email,u.name,u.role,u.status,q.period,q.limit_count,q.used_count,q.reserved_count,q.updated_at
    FROM users u JOIN usage_quotas q ON q.user_id=u.id AND q.period=? ORDER BY u.created_at DESC LIMIT 100`,
    )
    .all(currentPeriod()) as ModelRow[];
}

export function updateUserQuota(userId: string, limitCount: number) {
  const user = getAuthUserById(userId);
  if (!user) return { ok: false as const, reason: "NOT_FOUND" };
  const quota = quotaForUser(user);
  if (limitCount < quota.used + quota.reserved)
    return { ok: false as const, reason: "BELOW_USAGE" };
  const database = db();
  database.exec("BEGIN IMMEDIATE");
  try {
    database
      .prepare(
        "UPDATE usage_quotas SET limit_count=?,updated_at=? WHERE user_id=? AND period=?",
      )
      .run(limitCount, new Date().toISOString(), userId, quota.period);
    recordAdminAudit("quota.updated", "user", userId, {
      limitCount,
      period: quota.period,
    });
    database.exec("COMMIT");
    return {
      ok: true as const,
      quota: {
        ...quota,
        limit: limitCount,
        remaining: limitCount - quota.used - quota.reserved,
      },
    };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function resetUserFreePreview(userId: string) {
  const user = getAuthUserById(userId);
  if (!user) return { ok: false as const, reason: "NOT_FOUND" };
  if (user.role !== "personal")
    return { ok: false as const, reason: "NOT_PERSONAL" };

  const database = db();
  const ownerKey = `user:${userId}`;
  const now = new Date().toISOString();
  database.exec("BEGIN IMMEDIATE");
  try {
    database
      .prepare(
        "INSERT OR IGNORE INTO generation_wallets(owner_key,user_id,trial_used,trial_reserved,credit_sets,credit_reserved,updated_at) VALUES(?,?,0,0,0,0,?)",
      )
      .run(ownerKey, userId, now);
    const wallet = database
      .prepare(
        "SELECT trial_used,trial_reserved FROM generation_wallets WHERE owner_key=?",
      )
      .get(ownerKey) as
      | { trial_used: number; trial_reserved: number }
      | undefined;
    if (Number(wallet?.trial_reserved ?? 0) > 0) {
      database.exec("ROLLBACK");
      return { ok: false as const, reason: "TRIAL_IN_PROGRESS" };
    }
    database
      .prepare(
        "UPDATE generation_wallets SET trial_used=0,trial_reserved=0,updated_at=? WHERE owner_key=?",
      )
      .run(now, ownerKey);
    recordAdminAudit("trial.reset", "user", userId, {
      previousTrialUsed: Number(wallet?.trial_used ?? 0),
    });
    database.exec("COMMIT");
    return { ok: true as const };
  } catch (error) {
    try {
      database.exec("ROLLBACK");
    } catch {
      // The transaction may already have been closed by SQLite.
    }
    throw error;
  }
}

export function quotaForUser(user: AuthUser) {
  const period = currentPeriod();
  const limit = entitledQuota(user, ROLE_LIMITS[user.role]);
  const owner =
    user.role === "staff" && user.storeId
      ? (db()
          .prepare("SELECT owner_user_id AS id FROM stores WHERE id=?")
          .get(user.storeId) as { id?: string } | undefined)
      : null;
  const ownerUserId = owner?.id ?? user.id;
  const now = new Date().toISOString();
  db()
    .prepare(
      "INSERT OR IGNORE INTO usage_quotas(user_id,period,limit_count,used_count,reserved_count,updated_at) VALUES(?,?,?,0,0,?)",
    )
    .run(ownerUserId, period, limit, now);
  db()
    .prepare(
      "UPDATE usage_quotas SET limit_count=MAX(used_count+reserved_count,?),updated_at=? WHERE user_id=? AND period=? AND limit_count!=?",
    )
    .run(limit, now, ownerUserId, period, limit);
  const row = db()
    .prepare("SELECT * FROM usage_quotas WHERE user_id=? AND period=?")
    .get(ownerUserId, period) as ModelRow;
  return {
    ownerUserId,
    period,
    limit: Number(row.limit_count),
    used: Number(row.used_count),
    reserved: Number(row.reserved_count),
    remaining: Math.max(
      0,
      Number(row.limit_count) -
        Number(row.used_count) -
        Number(row.reserved_count),
    ),
  };
}

export function enqueueGeneration(
  taskId: string,
  user: AuthUser | null,
  variantCount: number,
) {
  const database = db();
  const model = getActiveModelConfig();
  if (!model) throw new Error("NO_ACTIVE_MODEL");
  const now = new Date().toISOString();
  const estimated = model.costPerImageMicros * variantCount;
  database.exec("BEGIN IMMEDIATE");
  try {
    if (user) {
      const quota = quotaForUser(user);
      const result = database
        .prepare(
          "UPDATE usage_quotas SET reserved_count=reserved_count+?,updated_at=? WHERE user_id=? AND period=? AND used_count+reserved_count+?<=limit_count",
        )
        .run(variantCount, now, user.id, quota.period, variantCount);
      if (result.changes === 0) throw new Error("QUOTA_EXCEEDED");
    }
    const id = crypto.randomUUID();
    database
      .prepare(
        `INSERT INTO generation_jobs(id,task_id,user_id,model_config_id,status,variant_count,cost_per_image_micros,estimated_cost_micros,actual_cost_micros,currency,error_code,attempts,queued_at)
      VALUES(?,?,?,?, 'queued',?,?,?,0,?,NULL,0,?)`,
      )
      .run(
        id,
        taskId,
        user?.id ?? null,
        model.id,
        variantCount,
        model.costPerImageMicros,
        estimated,
        model.currency,
        now,
      );
    database.exec("COMMIT");
    return { id, model, estimatedCostMicros: estimated };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function startGenerationJob(id: string) {
  db()
    .prepare(
      "UPDATE generation_jobs SET status='processing',attempts=attempts+1,started_at=? WHERE id=? AND status='queued'",
    )
    .run(new Date().toISOString(), id);
}

export function completeGenerationJob(id: string, actualCostMicros: number) {
  const database = db();
  const job = database
    .prepare("SELECT * FROM generation_jobs WHERE id=?")
    .get(id) as ModelRow | undefined;
  if (!job) return;
  database.exec("BEGIN IMMEDIATE");
  try {
    const changed =
      database
        .prepare(
          "UPDATE generation_jobs SET status='completed',actual_cost_micros=actual_cost_micros+?,completed_at=? WHERE id=? AND status='processing'",
        )
        .run(Math.max(0, actualCostMicros), new Date().toISOString(), id)
        .changes > 0;
    if (changed && job.user_id) {
      const period = currentPeriod(new Date(String(job.queued_at)));
      database
        .prepare(
          "UPDATE usage_quotas SET reserved_count=MAX(0,reserved_count-?),used_count=used_count+?,updated_at=? WHERE user_id=? AND period=?",
        )
        .run(
          Number(job.variant_count),
          Number(job.variant_count),
          new Date().toISOString(),
          String(job.user_id),
          period,
        );
    }
    database.exec("COMMIT");
    return changed;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function failGenerationJob(
  id: string,
  errorCode: string,
  actualCostMicros = 0,
) {
  const database = db();
  const job = database
    .prepare("SELECT * FROM generation_jobs WHERE id=?")
    .get(id) as ModelRow | undefined;
  if (!job) return;
  database.exec("BEGIN IMMEDIATE");
  try {
    const changed =
      database
        .prepare(
          "UPDATE generation_jobs SET status='failed',error_code=?,actual_cost_micros=actual_cost_micros+?,completed_at=? WHERE id=? AND status IN ('queued','processing')",
        )
        .run(
          errorCode,
          Math.max(0, actualCostMicros),
          new Date().toISOString(),
          id,
        ).changes > 0;
    if (changed && job.user_id) {
      const period = currentPeriod(new Date(String(job.queued_at)));
      database
        .prepare(
          "UPDATE usage_quotas SET reserved_count=MAX(0,reserved_count-?),updated_at=? WHERE user_id=? AND period=?",
        )
        .run(
          Number(job.variant_count),
          new Date().toISOString(),
          String(job.user_id),
          period,
        );
    }
    database.exec("COMMIT");
    return changed;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function cancelGenerationJob(id: string, actualCostMicros = 0) {
  const database = db();
  const job = database
    .prepare("SELECT * FROM generation_jobs WHERE id=?")
    .get(id) as ModelRow | undefined;
  if (!job) return false;
  database.exec("BEGIN IMMEDIATE");
  try {
    const changed =
      database
        .prepare(
          "UPDATE generation_jobs SET status='cancelled',actual_cost_micros=actual_cost_micros+?,completed_at=? WHERE id=? AND status IN ('queued','processing')",
        )
        .run(Math.max(0, actualCostMicros), new Date().toISOString(), id)
        .changes > 0;
    if (changed && job.user_id) {
      const period = currentPeriod(new Date(String(job.queued_at)));
      database
        .prepare(
          "UPDATE usage_quotas SET reserved_count=MAX(0,reserved_count-?),updated_at=? WHERE user_id=? AND period=?",
        )
        .run(
          Number(job.variant_count),
          new Date().toISOString(),
          String(job.user_id),
          period,
        );
    }
    database.exec("COMMIT");
    return changed;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function listGenerationJobs() {
  return db()
    .prepare(
      `SELECT j.*,m.name AS model_name,u.name AS user_name,p.max_attempts,p.last_error,p.cancel_requested,p.available_at FROM generation_jobs j LEFT JOIN model_configs m ON m.id=j.model_config_id LEFT JOIN users u ON u.id=j.user_id LEFT JOIN generation_job_payloads p ON p.job_id=j.id ORDER BY j.queued_at DESC LIMIT 100`,
    )
    .all() as ModelRow[];
}

export function costSummary() {
  const row = db()
    .prepare(
      "SELECT SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS jobs,COALESCE(SUM(CASE WHEN status='completed' THEN variant_count ELSE 0 END),0) AS images FROM generation_jobs",
    )
    .get() as ModelRow;
  const totals = db()
    .prepare(
      "SELECT currency,COALESCE(SUM(actual_cost_micros),0) AS total FROM generation_jobs GROUP BY currency ORDER BY currency",
    )
    .all() as Array<{ currency: string; total: number }>;
  return {
    jobs: Number(row.jobs),
    images: Number(row.images),
    costsByCurrency: Object.fromEntries(
      totals.map((item) => [String(item.currency), Number(item.total)]),
    ),
  };
}
