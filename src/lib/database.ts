import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

export type UserRole = "personal" | "store_owner" | "staff";

export const RUNNINGHUB_CHINA_ENDPOINT =
  "https://www.runninghub.cn/openapi/v2/rhart-image-n-g31-flash-lite/image-to-image";
export const RUNNINGHUB_INTERNATIONAL_ENDPOINT =
  "https://www.runninghub.ai/openapi/v2/rhart-image-n-g31-flash-lite/image-to-image";
export const RUNNINGHUB_INTERNATIONAL_CURRENCY = "USD";
export const RUNNINGHUB_INTERNATIONAL_COST_PER_IMAGE_MICROS = 15_000;

export interface AuthUser {
  id: string;
  phone: string;
  email: string | null;
  name: string;
  role: UserRole;
  storeId: string | null;
  storeName: string | null;
  status: "active" | "disabled";
  createdAt: string;
}

const globalDatabase = globalThis as typeof globalThis & {
  __hairDatabase?: DatabaseSync;
  __hairDatabasePath?: string;
};

export function databasePath() {
  return process.env.SQLITE_PATH ?? join(process.cwd(), "data", "hairstyle.db");
}

function createDatabase(path: string) {
  const dataDir = dirname(path);
  mkdirSync(dataDir, { recursive: true });
  const database = new DatabaseSync(path);
  database.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      phone TEXT NOT NULL UNIQUE,
      email TEXT UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('personal','store_owner','staff')),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS stores (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS store_members (
      store_id TEXT NOT NULL REFERENCES stores(id),
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
      created_at TEXT NOT NULL,
      PRIMARY KEY(store_id,user_id)
    );
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      token_hash TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      used_at INTEGER,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS usage_records (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      task_id TEXT NOT NULL,
      generation_mode TEXT NOT NULL,
      variant_count INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS model_configs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      endpoint TEXT,
      encrypted_api_key TEXT,
      enabled INTEGER NOT NULL DEFAULT 0,
      priority INTEGER NOT NULL DEFAULT 100,
      timeout_ms INTEGER NOT NULL DEFAULT 120000,
      cost_per_image_micros INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'CNY',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS generation_jobs (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL UNIQUE,
      user_id TEXT REFERENCES users(id),
      model_config_id TEXT REFERENCES model_configs(id),
      status TEXT NOT NULL CHECK(status IN ('queued','processing','completed','failed','cancelled')),
      variant_count INTEGER NOT NULL,
      cost_per_image_micros INTEGER NOT NULL DEFAULT 0,
      estimated_cost_micros INTEGER NOT NULL DEFAULT 0,
      actual_cost_micros INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'CNY',
      error_code TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      queued_at TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS usage_quotas (
      user_id TEXT NOT NULL REFERENCES users(id),
      period TEXT NOT NULL,
      limit_count INTEGER NOT NULL,
      used_count INTEGER NOT NULL DEFAULT 0,
      reserved_count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY(user_id,period)
    );
    CREATE TABLE IF NOT EXISTS generation_wallets (
      owner_key TEXT PRIMARY KEY,
      user_id TEXT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      trial_used INTEGER NOT NULL DEFAULT 0,
      trial_reserved INTEGER NOT NULL DEFAULT 0,
      credit_sets INTEGER NOT NULL DEFAULT 0,
      credit_reserved INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS generated_assets (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      owner_session_id TEXT NOT NULL,
      user_id TEXT REFERENCES users(id),
      file_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS design_tasks (
      id TEXT PRIMARY KEY,
      owner_session_id TEXT NOT NULL,
      user_id TEXT REFERENCES users(id),
      status TEXT NOT NULL CHECK(status IN ('processing','completed','failed','deleted')),
      preferences_json TEXT NOT NULL,
      variants_json TEXT NOT NULL,
      generation_mode TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS task_feedback (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES design_tasks(id) ON DELETE CASCADE,
      variant_id TEXT NOT NULL,
      helpful INTEGER NOT NULL,
      issue TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS task_selections (
      task_id TEXT PRIMARY KEY REFERENCES design_tasks(id) ON DELETE CASCADE,
      variant_id TEXT NOT NULL,
      selected_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS generation_job_payloads (
      job_id TEXT PRIMARY KEY REFERENCES generation_jobs(id) ON DELETE CASCADE,
      owner_session_id TEXT NOT NULL,
      owner_key TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      source_image_path TEXT,
      source_expires_at INTEGER,
      available_at INTEGER NOT NULL,
      lock_token TEXT,
      locked_at INTEGER,
      heartbeat_at INTEGER,
      cancel_requested INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 3,
      last_error TEXT,
      UNIQUE(owner_key,idempotency_key)
    );
    CREATE TABLE IF NOT EXISTS generation_access_charges (
      job_id TEXT PRIMARY KEY REFERENCES generation_jobs(id) ON DELETE CASCADE,
      owner_key TEXT NOT NULL,
      source TEXT NOT NULL CHECK(source IN ('trial','pack','subscription')),
      quota_user_id TEXT REFERENCES users(id),
      quota_period TEXT,
      quota_units INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL CHECK(status IN ('reserved','consumed','released')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS gumroad_pack_grants (
      sale_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL,
      license_fingerprint TEXT NOT NULL UNIQUE,
      purchase_email TEXT NOT NULL,
      set_count INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS rate_limit_events (
      id TEXT PRIMARY KEY,
      scope TEXT NOT NULL,
      identity_hash TEXT NOT NULL,
      occurred_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_type TEXT NOT NULL,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      details_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS operational_events (
      id TEXT PRIMARY KEY,
      level TEXT NOT NULL CHECK(level IN ('info','warning','critical')),
      event_type TEXT NOT NULL,
      resource_id TEXT,
      message TEXT NOT NULL,
      details_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS operational_alerts (
      code TEXT PRIMARY KEY,
      severity TEXT NOT NULL CHECK(severity IN ('warning','critical')),
      status TEXT NOT NULL CHECK(status IN ('open','resolved')),
      message TEXT NOT NULL,
      details_json TEXT NOT NULL,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      notified_at TEXT
    );
    CREATE TABLE IF NOT EXISTS backup_runs (
      id TEXT PRIMARY KEY,
      file_path TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      checksum_sha256 TEXT NOT NULL,
      app_version TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS billing_customers (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      stripe_customer_id TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS billing_subscriptions (
      stripe_subscription_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      stripe_customer_id TEXT NOT NULL,
      plan_key TEXT NOT NULL,
      price_id TEXT NOT NULL,
      status TEXT NOT NULL,
      current_period_end INTEGER,
      cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS stripe_events (
      event_id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      processed_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS paddle_customers (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      customer_id TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS paddle_subscriptions (
      subscription_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      customer_id TEXT NOT NULL,
      plan_key TEXT NOT NULL CHECK(plan_key IN ('personal_plus','salon_pro')),
      price_id TEXT NOT NULL,
      status TEXT NOT NULL,
      current_period_start INTEGER,
      next_billed_at INTEGER,
      cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
      scheduled_change_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS paddle_transactions (
      transaction_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      customer_id TEXT,
      subscription_id TEXT,
      purchase_key TEXT NOT NULL CHECK(purchase_key IN ('personal_pack','personal_plus','salon_pro')),
      price_id TEXT NOT NULL,
      status TEXT NOT NULL,
      currency_code TEXT NOT NULL,
      total_amount INTEGER NOT NULL DEFAULT 0,
      credited_sets INTEGER NOT NULL DEFAULT 0,
      reversed INTEGER NOT NULL DEFAULT 0,
      invoice_number TEXT,
      billed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS paddle_events (
      event_id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('processing','processed','failed')),
      attempts INTEGER NOT NULL DEFAULT 1,
      last_error TEXT,
      received_at TEXT NOT NULL,
      processed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS gumroad_licenses (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      plan_key TEXT NOT NULL CHECK(plan_key IN ('personal_plus','salon_pro')),
      product_id TEXT NOT NULL,
      encrypted_license_key TEXT NOT NULL,
      license_fingerprint TEXT NOT NULL UNIQUE,
      subscription_id TEXT NOT NULL UNIQUE,
      sale_id TEXT,
      purchase_email TEXT NOT NULL,
      recurrence TEXT NOT NULL,
      status TEXT NOT NULL,
      access_until INTEGER,
      cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
      last_verified_at INTEGER NOT NULL,
      verification_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS salons (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      stylist_name TEXT,
      email TEXT,
      owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS consultations (
      id TEXT PRIMARY KEY,
      salon_id TEXT REFERENCES salons(id) ON DELETE SET NULL,
      customer_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      stylist_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      status TEXT NOT NULL CHECK(status IN ('draft','analyzing','ready','shared','completed','archived')),
      source_photo_path TEXT,
      source_consent_at TEXT,
      source_consent_version TEXT,
      source_quality_json TEXT,
      analysis_json TEXT,
      generated_images_json TEXT,
      selected_recommendation_id TEXT,
      generation_status TEXT NOT NULL DEFAULT 'idle' CHECK(generation_status IN ('idle','queued','processing','partial','completed','failed','cancelled')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS recommendations (
      id TEXT PRIMARY KEY,
      consultation_id TEXT NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
      style_name TEXT NOT NULL,
      rationale TEXT NOT NULL,
      execution_json TEXT NOT NULL,
      image_url TEXT,
      rank INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON auth_sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id,expires_at);
    CREATE INDEX IF NOT EXISTS idx_usage_user ON usage_records(user_id,created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_jobs_status ON generation_jobs(status,queued_at);
    CREATE INDEX IF NOT EXISTS idx_assets_task ON generated_assets(task_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_session ON design_tasks(owner_session_id,created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_tasks_user ON design_tasks(user_id,created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_rate_limit ON rate_limit_events(scope,identity_hash,occurred_at);
    CREATE INDEX IF NOT EXISTS idx_payload_available ON generation_job_payloads(available_at,cancel_requested);
    CREATE INDEX IF NOT EXISTS idx_access_owner ON generation_access_charges(owner_key,status);
    CREATE INDEX IF NOT EXISTS idx_events_created ON operational_events(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_alerts_status ON operational_alerts(status,last_seen_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_billing_user ON billing_subscriptions(user_id,status);
    CREATE INDEX IF NOT EXISTS idx_paddle_subscription_user ON paddle_subscriptions(user_id,status);
    CREATE INDEX IF NOT EXISTS idx_paddle_transaction_user ON paddle_transactions(user_id,billed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_gumroad_verify ON gumroad_licenses(last_verified_at,status);
    CREATE INDEX IF NOT EXISTS idx_consultations_salon ON consultations(salon_id,created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_consultations_customer ON consultations(customer_user_id,created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_recommendations_consultation ON recommendations(consultation_id,rank);
  `);
  const userColumns = database
    .prepare("PRAGMA table_info(users)")
    .all() as Array<{ name: string }>;
  if (!userColumns.some((column) => column.name === "email"))
    database.exec("ALTER TABLE users ADD COLUMN email TEXT");
  const consultationColumns = database
    .prepare("PRAGMA table_info(consultations)")
    .all() as Array<{ name: string }>;
  const consultationMigrations: Array<[string, string]> = [
    ["source_consent_at", "ALTER TABLE consultations ADD COLUMN source_consent_at TEXT"],
    ["source_consent_version", "ALTER TABLE consultations ADD COLUMN source_consent_version TEXT"],
    ["source_quality_json", "ALTER TABLE consultations ADD COLUMN source_quality_json TEXT"],
    ["generation_status", "ALTER TABLE consultations ADD COLUMN generation_status TEXT NOT NULL DEFAULT 'idle'"],
  ];
  for (const [name, statement] of consultationMigrations) {
    if (!consultationColumns.some((column) => column.name === name)) database.exec(statement);
  }
  const generationJobColumns = database
    .prepare("PRAGMA table_info(generation_jobs)")
    .all() as Array<{ name: string }>;
  if (!generationJobColumns.some((column) => column.name === "currency"))
    database.exec(
      "ALTER TABLE generation_jobs ADD COLUMN currency TEXT NOT NULL DEFAULT 'CNY'",
    );
  if (!generationJobColumns.some((column) => column.name === "cost_per_image_micros"))
    database.exec(
      "ALTER TABLE generation_jobs ADD COLUMN cost_per_image_micros INTEGER NOT NULL DEFAULT 0",
    );
  database.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL",
  );
  const now = new Date().toISOString();
  database
    .prepare(
      `INSERT OR IGNORE INTO model_configs
    (id,name,provider,model,endpoint,encrypted_api_key,enabled,priority,timeout_ms,cost_per_image_micros,currency,created_at,updated_at)
    VALUES('demo-fixed','本地演示模型','local','demo-fixed',NULL,NULL,1,999,5000,0,'CNY',?,?)`,
    )
    .run(now, now);
  database
    .prepare(
      "UPDATE model_configs SET priority=999 WHERE id='demo-fixed' AND priority=1",
    )
    .run();
  database
    .prepare(
      `INSERT OR IGNORE INTO model_configs
    (id,name,provider,model,endpoint,encrypted_api_key,enabled,priority,timeout_ms,cost_per_image_micros,currency,created_at,updated_at)
    VALUES('runninghub-g31-flash-lite','RunningHub G31 Flash Lite','runninghub','rhart-image-n-g31-flash-lite',?,NULL,0,100,180000,?,?,?,?)`,
    )
    .run(
      RUNNINGHUB_INTERNATIONAL_ENDPOINT,
      RUNNINGHUB_INTERNATIONAL_COST_PER_IMAGE_MICROS,
      RUNNINGHUB_INTERNATIONAL_CURRENCY,
      now,
      now,
    );
  database
    .prepare(
      "UPDATE model_configs SET endpoint=?,updated_at=? WHERE id=? AND endpoint=?",
    )
    .run(
      RUNNINGHUB_INTERNATIONAL_ENDPOINT,
      now,
      "runninghub-g31-flash-lite",
      RUNNINGHUB_CHINA_ENDPOINT,
    );
  database
    .prepare(
      "UPDATE model_configs SET cost_per_image_micros=?,currency=?,updated_at=? WHERE id=? AND endpoint=? AND (cost_per_image_micros<>? OR currency<>?)",
    )
    .run(
      RUNNINGHUB_INTERNATIONAL_COST_PER_IMAGE_MICROS,
      RUNNINGHUB_INTERNATIONAL_CURRENCY,
      now,
      "runninghub-g31-flash-lite",
      RUNNINGHUB_INTERNATIONAL_ENDPOINT,
      RUNNINGHUB_INTERNATIONAL_COST_PER_IMAGE_MICROS,
      RUNNINGHUB_INTERNATIONAL_CURRENCY,
    );
  return database;
}

export function db() {
  const path = databasePath();
  if (
    !globalDatabase.__hairDatabase ||
    globalDatabase.__hairDatabasePath !== path
  ) {
    globalDatabase.__hairDatabase?.close();
    globalDatabase.__hairDatabase = createDatabase(path);
    globalDatabase.__hairDatabasePath = path;
  }
  return globalDatabase.__hairDatabase;
}

export function closeDatabaseForTest() {
  if (process.env.NODE_ENV !== "test") throw new Error("TEST_ONLY");
  globalDatabase.__hairDatabase?.close();
  delete globalDatabase.__hairDatabase;
  delete globalDatabase.__hairDatabasePath;
}

export function findUserByPhone(phone: string) {
  return db().prepare("SELECT * FROM users WHERE phone = ?").get(phone) as
    | Record<string, unknown>
    | undefined;
}

export function findUserByEmail(email: string) {
  return db()
    .prepare("SELECT * FROM users WHERE lower(email)=lower(?)")
    .get(email) as Record<string, unknown> | undefined;
}

export function getAuthUserById(id: string): AuthUser | null {
  const row = db()
    .prepare(
      `SELECT u.id,u.phone,u.email,u.name,u.role,u.status,u.created_at,
    s.id AS store_id,s.name AS store_name
    FROM users u LEFT JOIN store_members sm ON sm.user_id=u.id
    LEFT JOIN stores s ON s.id=sm.store_id WHERE u.id=?`,
    )
    .get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: String(row.id),
    phone: String(row.phone),
    email: row.email ? String(row.email) : null,
    name: String(row.name),
    role: row.role as UserRole,
    status: row.status as AuthUser["status"],
    storeId: row.store_id ? String(row.store_id) : null,
    storeName: row.store_name ? String(row.store_name) : null,
    createdAt: String(row.created_at),
  };
}

export function listUsers() {
  return db()
    .prepare(
      "SELECT id,phone,email,name,role,status,created_at FROM users ORDER BY created_at DESC LIMIT 100",
    )
    .all() as Record<string, unknown>[];
}

export function listStoreMembers(storeId: string) {
  return db()
    .prepare(
      `SELECT u.id,u.phone,u.email,u.name,u.role,u.status,u.created_at FROM users u
    JOIN store_members sm ON sm.user_id=u.id WHERE sm.store_id=? ORDER BY u.created_at`,
    )
    .all(storeId) as Record<string, unknown>[];
}

export function listUsageRecords(userId: string) {
  return db()
    .prepare(
      "SELECT task_id,generation_mode,variant_count,created_at FROM usage_records WHERE user_id=? ORDER BY created_at DESC LIMIT 20",
    )
    .all(userId) as Record<string, unknown>[];
}

export function recordUsage(
  userId: string | null,
  taskId: string,
  generationMode: string,
  variantCount: number,
) {
  db()
    .prepare(
      "INSERT INTO usage_records(id,user_id,task_id,generation_mode,variant_count,created_at) VALUES(?,?,?,?,?,?)",
    )
    .run(
      crypto.randomUUID(),
      userId,
      taskId,
      generationMode,
      variantCount,
      new Date().toISOString(),
    );
}
