import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { db } from "./database";

const MIME_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const EXTENSION_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export function uploadsDirectory() {
  return (
    process.env.SOURCE_UPLOADS_DIR ??
    join(/* turbopackIgnore: true */ process.cwd(), "data", "uploads")
  );
}

function safePath(path: string, root = uploadsDirectory()) {
  const resolved = resolve(/* turbopackIgnore: true */ path);
  const storage = resolve(/* turbopackIgnore: true */ root);
  if (resolved !== storage && !resolved.startsWith(`${storage}/`))
    throw new Error("SOURCE_PATH_OUTSIDE_STORAGE");
  return resolved;
}

function validSignature(bytes: Buffer, mime: string) {
  if (mime === "image/png")
    return bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mime === "image/jpeg")
    return (
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes.at(-2) === 0xff &&
      bytes.at(-1) === 0xd9
    );
  if (mime === "image/webp")
    return (
      bytes.subarray(0, 4).toString() === "RIFF" &&
      bytes.subarray(8, 12).toString() === "WEBP"
    );
  return false;
}

export function persistSourceImage(
  dataUrl: string | undefined,
  taskId: string,
  root = uploadsDirectory(),
) {
  if (!dataUrl) return { path: null, expiresAt: null };
  const match =
    /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error("INVALID_SOURCE_IMAGE");
  const mime = match[1];
  const bytes = Buffer.from(match[2], "base64");
  if (
    bytes.length === 0 ||
    bytes.length > 8 * 1024 * 1024 ||
    !validSignature(bytes, mime)
  )
    throw new Error("INVALID_SOURCE_IMAGE");
  mkdirSync(root, { recursive: true, mode: 0o700 });
  const path = join(
    /* turbopackIgnore: true */ root,
    `${taskId}.${MIME_EXTENSION[mime]}`,
  );
  writeFileSync(path, bytes, { mode: 0o600 });
  return { path, expiresAt: Date.now() + 24 * 60 * 60 * 1000 };
}

export function readSourceImage(path: string | null) {
  if (!path) return undefined;
  const safe = safePath(path);
  const bytes = readFileSync(/* turbopackIgnore: true */ safe);
  if (bytes.length > 8 * 1024 * 1024) throw new Error("SOURCE_IMAGE_TOO_LARGE");
  const mime = EXTENSION_MIME[extname(safe).toLowerCase()];
  if (!mime || !validSignature(bytes, mime))
    throw new Error("INVALID_SOURCE_IMAGE");
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

export function removeSourceImage(path: string | null) {
  if (path) rmSync(safePath(path), { force: true });
}

export function cleanupExpiredSourceImages(now = Date.now()) {
  const rows = db()
    .prepare(
      "SELECT job_id,source_image_path FROM generation_job_payloads WHERE source_image_path IS NOT NULL AND source_expires_at<=?",
    )
    .all(now) as Array<{ job_id: string; source_image_path: string }>;
  let deleted = 0;
  for (const row of rows) {
    try {
      removeSourceImage(row.source_image_path);
      db()
        .prepare(
          "UPDATE generation_job_payloads SET source_image_path=NULL,source_expires_at=NULL WHERE job_id=?",
        )
        .run(row.job_id);
      deleted += 1;
    } catch {
      /* keep row for operator review */
    }
  }
  return { found: rows.length, deleted };
}
