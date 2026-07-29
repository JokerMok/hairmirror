import { rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { db } from "./database";
import {
  normalizeDesignPreferences,
  type StoredDesignTask,
  type TaskFeedback,
} from "./types";
import { removeSourceImage } from "./source-storage";

type TaskRow = Record<string, unknown>;

function deserializeTask(row: TaskRow): StoredDesignTask {
  const jobStatus = row.job_status
    ? String(row.job_status)
    : String(row.status);
  return {
    id: String(row.id),
    ownerSessionId: String(row.owner_session_id),
    userId: row.user_id ? String(row.user_id) : null,
    status: (jobStatus === "cancelled"
      ? "cancelled"
      : jobStatus === "queued"
        ? "queued"
        : row.status) as StoredDesignTask["status"],
    createdAt: String(row.created_at),
    preferences: normalizeDesignPreferences(
      JSON.parse(String(row.preferences_json)) as Partial<
        StoredDesignTask["preferences"]
      >,
    ),
    variants: JSON.parse(
      String(row.variants_json),
    ) as StoredDesignTask["variants"],
    generationMode: row.generation_mode as StoredDesignTask["generationMode"],
    selectedVariantId: row.selected_variant_id
      ? String(row.selected_variant_id)
      : undefined,
    errorCode: row.error_code ? String(row.error_code) : undefined,
  };
}

function ownerWhere(userId: string | null) {
  return userId
    ? { sql: "user_id=?", value: userId }
    : { sql: "user_id IS NULL AND owner_session_id=?", value: null };
}

export function addTask(task: StoredDesignTask) {
  db()
    .prepare(
      `INSERT INTO design_tasks(id,owner_session_id,user_id,status,preferences_json,variants_json,generation_mode,created_at)
    VALUES(?,?,?,?,?,?,?,?)`,
    )
    .run(
      task.id,
      task.ownerSessionId,
      task.userId ?? null,
      task.status,
      JSON.stringify(task.preferences),
      JSON.stringify(task.variants),
      task.generationMode,
      task.createdAt,
    );
  return task;
}

export function listTasks(
  ownerSessionId: string,
  userId: string | null,
  limit = 6,
) {
  const owner = ownerWhere(userId);
  const value = userId ?? ownerSessionId;
  return (
    db()
      .prepare(
        `SELECT t.*,s.variant_id AS selected_variant_id,j.status AS job_status,j.error_code FROM design_tasks t LEFT JOIN task_selections s ON s.task_id=t.id LEFT JOIN generation_jobs j ON j.task_id=t.id WHERE ${owner.sql.replaceAll("user_id", "t.user_id").replaceAll("owner_session_id", "t.owner_session_id")} AND t.status!='deleted' ORDER BY t.created_at DESC LIMIT ?`,
      )
      .all(value, limit) as TaskRow[]
  ).map(deserializeTask);
}

export function listAllTasks(limit = 100) {
  return (
    db()
      .prepare(
        "SELECT t.*,s.variant_id AS selected_variant_id,j.status AS job_status,j.error_code FROM design_tasks t LEFT JOIN task_selections s ON s.task_id=t.id LEFT JOIN generation_jobs j ON j.task_id=t.id WHERE t.status!='deleted' ORDER BY t.created_at DESC LIMIT ?",
      )
      .all(limit) as TaskRow[]
  ).map(deserializeTask);
}

export function getTaskForOwner(
  id: string,
  ownerSessionId: string,
  userId: string | null,
) {
  const owner = ownerWhere(userId);
  const value = userId ?? ownerSessionId;
  const row = db()
    .prepare(
      `SELECT t.*,s.variant_id AS selected_variant_id,j.status AS job_status,j.error_code FROM design_tasks t LEFT JOIN task_selections s ON s.task_id=t.id LEFT JOIN generation_jobs j ON j.task_id=t.id WHERE t.id=? AND ${owner.sql.replaceAll("user_id", "t.user_id").replaceAll("owner_session_id", "t.owner_session_id")} AND t.status!='deleted'`,
    )
    .get(id, value) as TaskRow | undefined;
  return row ? deserializeTask(row) : null;
}

export function getTaskInternal(id: string) {
  const row = db()
    .prepare(
      "SELECT t.*,s.variant_id AS selected_variant_id,j.status AS job_status,j.error_code FROM design_tasks t LEFT JOIN task_selections s ON s.task_id=t.id LEFT JOIN generation_jobs j ON j.task_id=t.id WHERE t.id=?",
    )
    .get(id) as TaskRow | undefined;
  return row ? deserializeTask(row) : null;
}

export function updateTaskFromWorker(
  id: string,
  input: {
    status: "processing" | "completed" | "failed";
    variants?: StoredDesignTask["variants"];
    generationMode?: StoredDesignTask["generationMode"];
  },
) {
  const row = db()
    .prepare(
      "SELECT variants_json,generation_mode FROM design_tasks WHERE id=?",
    )
    .get(id) as { variants_json: string; generation_mode: string } | undefined;
  if (!row) return false;
  return (
    db()
      .prepare(
        "UPDATE design_tasks SET status=?,variants_json=?,generation_mode=? WHERE id=?",
      )
      .run(
        input.status,
        JSON.stringify(input.variants ?? JSON.parse(row.variants_json)),
        input.generationMode ?? row.generation_mode,
        id,
      ).changes > 0
  );
}

export function deleteTask(
  id: string,
  ownerSessionId: string,
  userId: string | null,
  storageRoot = process.env.GENERATED_ASSETS_DIR ??
    join(process.cwd(), "data", "generated"),
) {
  const owner = ownerWhere(userId);
  const value = userId ?? ownerSessionId;
  const database = db();
  const task = database
    .prepare(`SELECT id FROM design_tasks WHERE id=? AND ${owner.sql}`)
    .get(id, value);
  if (!task) return false;
  const payload = database
    .prepare(
      "SELECT p.job_id,p.source_image_path FROM generation_job_payloads p JOIN generation_jobs j ON j.id=p.job_id WHERE j.task_id=?",
    )
    .get(id) as { job_id?: string; source_image_path?: string } | undefined;
  if (payload?.source_image_path) removeSourceImage(payload.source_image_path);
  const assets = database
    .prepare("SELECT file_path FROM generated_assets WHERE task_id=?")
    .all(id) as Array<{ file_path: string }>;
  const generatedRoot = resolve(storageRoot);
  for (const asset of assets) {
    const file = resolve(/* turbopackIgnore: true */ String(asset.file_path));
    if (file !== generatedRoot && !file.startsWith(`${generatedRoot}/`))
      throw new Error("ASSET_PATH_OUTSIDE_STORAGE");
    rmSync(file, { force: true });
  }
  database.exec("BEGIN IMMEDIATE");
  try {
    database.prepare("DELETE FROM generated_assets WHERE task_id=?").run(id);
    database.prepare("DELETE FROM task_feedback WHERE task_id=?").run(id);
    database.prepare("DELETE FROM task_selections WHERE task_id=?").run(id);
    database.prepare("DELETE FROM design_tasks WHERE id=?").run(id);
    database.prepare("DELETE FROM usage_records WHERE task_id=?").run(id);
    if (payload?.job_id) {
      database
        .prepare("UPDATE generation_jobs SET user_id=NULL WHERE id=?")
        .run(payload.job_id);
      database
        .prepare(
          "UPDATE generation_job_payloads SET owner_session_id='deleted',owner_key='deleted:'||job_id,payload_json='{}',source_image_path=NULL,source_expires_at=NULL WHERE job_id=?",
        )
        .run(payload.job_id);
    }
    database.exec("COMMIT");
    return true;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function cleanupExpiredTasks(
  now = Date.now(),
  retentionMs = 30 * 24 * 60 * 60 * 1000,
) {
  const cutoff = new Date(now - retentionMs).toISOString();
  const rows = db()
    .prepare(
      `SELECT t.id,t.owner_session_id,t.user_id FROM design_tasks t
    LEFT JOIN generation_jobs j ON j.task_id=t.id
    WHERE t.created_at<=? AND t.status IN ('completed','failed','deleted') AND COALESCE(j.status,'completed') NOT IN ('queued','processing')`,
    )
    .all(cutoff) as Array<{
    id: string;
    owner_session_id: string;
    user_id: string | null;
  }>;
  let deleted = 0;
  for (const row of rows) {
    try {
      if (deleteTask(row.id, row.owner_session_id, row.user_id)) deleted += 1;
    } catch {
      /* 保留记录供运营人员复核 */
    }
  }
  return { found: rows.length, deleted, skipped: rows.length - deleted };
}

export function addFeedback(
  feedback: TaskFeedback,
  ownerSessionId: string,
  userId: string | null,
) {
  const owner = ownerWhere(userId);
  const value = userId ?? ownerSessionId;
  const row = db()
    .prepare(
      `SELECT variants_json FROM design_tasks WHERE id=? AND ${owner.sql} AND status='completed'`,
    )
    .get(feedback.taskId, value) as { variants_json?: string } | undefined;
  if (!row) return false;
  const variants = JSON.parse(
    String(row.variants_json),
  ) as StoredDesignTask["variants"];
  if (!variants.some((variant) => variant.id === feedback.variantId))
    return false;
  const database = db();
  database.exec("BEGIN IMMEDIATE");
  try {
    if (feedback.issue)
      database
        .prepare(
          "DELETE FROM task_feedback WHERE task_id=? AND variant_id=? AND issue IS NOT NULL",
        )
        .run(feedback.taskId, feedback.variantId);
    database
      .prepare(
        "INSERT INTO task_feedback(id,task_id,variant_id,helpful,issue,created_at) VALUES(?,?,?,?,?,?)",
      )
      .run(
        feedback.id,
        feedback.taskId,
        feedback.variantId,
        feedback.helpful ? 1 : 0,
        feedback.issue ?? null,
        feedback.createdAt,
      );
    if (feedback.helpful && !feedback.issue)
      database
        .prepare(
          "INSERT INTO task_selections(task_id,variant_id,selected_at) VALUES(?,?,?) ON CONFLICT(task_id) DO UPDATE SET variant_id=excluded.variant_id,selected_at=excluded.selected_at",
        )
        .run(feedback.taskId, feedback.variantId, feedback.createdAt);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  return true;
}

export function listFeedback() {
  return db()
    .prepare("SELECT * FROM task_feedback ORDER BY created_at DESC")
    .all() as Array<Record<string, unknown>>;
}

export function resetTaskStoreForTest() {
  if (process.env.NODE_ENV !== "test") throw new Error("TEST_ONLY");
  db().exec(
    "DELETE FROM task_feedback; DELETE FROM task_selections; DELETE FROM generation_job_payloads; DELETE FROM generation_jobs; DELETE FROM design_tasks; DELETE FROM generated_assets; DELETE FROM usage_records;",
  );
}
