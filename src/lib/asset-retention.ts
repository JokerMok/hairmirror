import { rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { db } from "./database";

function removeRows(
  rows: Array<{ id: string; file_path: string }>,
  storageRoot: string,
) {
  const database = db();
  const root = resolve(storageRoot);
  const removable: string[] = [];
  for (const row of rows) {
    const file = resolve(/* turbopackIgnore: true */ String(row.file_path));
    if (file !== root && !file.startsWith(`${root}/`)) continue;
    rmSync(file, { force: true });
    removable.push(row.id);
  }
  const remove = database.prepare("DELETE FROM generated_assets WHERE id=?");
  database.exec("BEGIN IMMEDIATE");
  try {
    for (const id of removable) remove.run(id);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  return {
    found: rows.length,
    deleted: removable.length,
    skipped: rows.length - removable.length,
  };
}

export function cleanupExpiredAssets(
  now = Date.now(),
  storageRoot = process.env.GENERATED_ASSETS_DIR ??
    join(process.cwd(), "data", "generated"),
) {
  const database = db();
  const rows = database
    .prepare("SELECT id,file_path FROM generated_assets WHERE expires_at<=?")
    .all(now) as Array<{ id: string; file_path: string }>;
  return removeRows(rows, storageRoot);
}

export function removeAssetsForTask(
  taskId: string,
  storageRoot = process.env.GENERATED_ASSETS_DIR ??
    join(process.cwd(), "data", "generated"),
) {
  const rows = db()
    .prepare("SELECT id,file_path FROM generated_assets WHERE task_id=?")
    .all(taskId) as Array<{ id: string; file_path: string }>;
  return removeRows(rows, storageRoot);
}
