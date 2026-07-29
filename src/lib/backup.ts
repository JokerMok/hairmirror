import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import { db } from "./database";
import { recordOperationalEvent } from "./operations";

type BackupManifest = {
  id: string;
  createdAt: string;
  appVersion: string;
  databaseFile: string;
  databaseSha256: string;
  assetsDirectory: string;
  sizeBytes: number;
  target: string;
};
const execFileAsync = promisify(execFile);
function version() {
  return process.env.APP_VERSION ?? "0.1.0";
}

export async function createBackup(now = new Date()) {
  try {
    const script = join(
      /* turbopackIgnore: true */ process.cwd(),
      "scripts",
      "create-backup.mjs",
    );
    const { stdout } = await execFileAsync(
      process.execPath,
      [script, now.toISOString(), version()],
      { env: process.env, maxBuffer: 1024 * 1024 },
    );
    const manifest = JSON.parse(stdout.trim()) as BackupManifest;
    db()
      .prepare(
        "INSERT INTO backup_runs(id,file_path,size_bytes,checksum_sha256,app_version,created_at) VALUES(?,?,?,?,?,?)",
      )
      .run(
        crypto.randomUUID(),
        manifest.target,
        manifest.sizeBytes,
        manifest.databaseSha256,
        manifest.appVersion,
        manifest.createdAt,
      );
    pruneBackups();
    recordOperationalEvent(
      "info",
      "backup.completed",
      "数据库和生成资产备份完成",
      null,
      { backup: manifest.id, sizeBytes: manifest.sizeBytes },
    );
    return manifest;
  } catch (error) {
    recordOperationalEvent("critical", "backup.failed", "备份失败", null, {
      message: error instanceof Error ? error.message : "UNKNOWN",
    });
    throw error;
  }
}

export function pruneBackups() {
  const keep = Math.max(2, Number(process.env.BACKUP_RETENTION_COUNT) || 7);
  const database = db();
  const rows = database
    .prepare(
      "SELECT id FROM backup_runs ORDER BY created_at DESC LIMIT -1 OFFSET ?",
    )
    .all(keep) as Array<{ id: string }>;
  const remove = database.prepare("DELETE FROM backup_runs WHERE id=?");
  for (const row of rows) remove.run(row.id);
  return { deleted: rows.length };
}

export async function maybeCreateScheduledBackup(now = new Date()) {
  const intervalHours = Math.max(
    1,
    Number(process.env.BACKUP_INTERVAL_HOURS) || 24,
  );
  const latest = db()
    .prepare(
      "SELECT created_at FROM backup_runs ORDER BY created_at DESC LIMIT 1",
    )
    .get() as { created_at?: string } | undefined;
  if (
    latest?.created_at &&
    now.getTime() - Date.parse(latest.created_at) <
      intervalHours * 60 * 60 * 1000
  )
    return { created: false as const };
  return { created: true as const, backup: await createBackup(now) };
}

export function listBackups() {
  return db()
    .prepare("SELECT * FROM backup_runs ORDER BY created_at DESC LIMIT 30")
    .all() as Array<Record<string, unknown>>;
}
