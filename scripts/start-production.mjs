import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

process.umask(0o077);

const railway = Boolean(process.env.RAILWAY_ENVIRONMENT);
const volumeRoot = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? resolve(process.env.RAILWAY_VOLUME_MOUNT_PATH)
  : resolve(process.env.PERSISTENT_DATA_DIR ?? "/app/data");

if (railway && !process.env.RAILWAY_VOLUME_MOUNT_PATH) {
  console.error("RAILWAY_VOLUME_REQUIRED: attach a volume before starting");
  process.exit(1);
}

const requiredSecrets = [
  "ADMIN_USERNAME",
  "ADMIN_PASSWORD",
  "INTERNAL_JOB_SECRET",
  "MODEL_SECRET_KEY",
  "BILLING_SECRET_KEY",
];
const missingSecrets = requiredSecrets.filter((name) => !process.env[name]);
if (missingSecrets.length > 0) {
  console.error(`MISSING_PRODUCTION_SECRETS: ${missingSecrets.join(",")}`);
  process.exit(1);
}

process.env.SQLITE_PATH ??= join(volumeRoot, "hairstyle.db");
process.env.GENERATED_ASSETS_DIR ??= join(volumeRoot, "generated");
process.env.SOURCE_UPLOADS_DIR ??= join(volumeRoot, "uploads");
process.env.BACKUP_DIR ??= join(volumeRoot, "backups");
process.env.HOSTNAME ??= "0.0.0.0";
process.env.PORT ??= "3000";
process.env.WORKER_BASE_URL ??= `http://127.0.0.1:${process.env.PORT}`;
process.env.DISABLE_INLINE_WORKER = "1";

for (const path of [
  volumeRoot,
  process.env.GENERATED_ASSETS_DIR,
  process.env.SOURCE_UPLOADS_DIR,
  process.env.BACKUP_DIR,
]) {
  mkdirSync(path, { recursive: true });
}

const children = new Set();
let stopping = false;

function launch(name, command, args) {
  const child = spawn(command, args, {
    env: process.env,
    stdio: "inherit",
  });
  children.add(child);
  child.on("exit", (code, signal) => {
    children.delete(child);
    if (stopping) return;
    console.error(`${name} exited unexpectedly (${signal ?? code ?? "unknown"})`);
    shutdown(code && code !== 0 ? code : 1);
  });
  return child;
}

function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  const timer = setTimeout(() => {
    for (const child of children) child.kill("SIGKILL");
    process.exit(code);
  }, 10_000);
  timer.unref();
  Promise.all(
    [...children].map(
      (child) => new Promise((resolveExit) => child.once("exit", resolveExit)),
    ),
  ).finally(() => process.exit(code));
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

launch("web", process.execPath, ["server.js"]);
launch("worker", process.execPath, ["scripts/worker.mjs"]);
