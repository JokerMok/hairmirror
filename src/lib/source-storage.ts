import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { db } from "./database";
import type { SourceImageQuality } from "./types";

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
const CONSULTATION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

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

function parseDataUrl(dataUrl: string) {
  const match =
    /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error("INVALID_SOURCE_IMAGE");
  const mime = match[1] as SourceImageQuality["mimeType"];
  const bytes = Buffer.from(match[2], "base64");
  if (
    bytes.length === 0 ||
    bytes.length > 8 * 1024 * 1024 ||
    !validSignature(bytes, mime)
  ) throw new Error("INVALID_SOURCE_IMAGE");
  return { mime, bytes };
}

function pngDimensions(bytes: Buffer) {
  if (bytes.length < 24) return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function jpegDimensions(bytes: Buffer) {
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) return null;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) return null;
    const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isFrame && length >= 7) {
      return { height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5) };
    }
    offset += length;
  }
  return null;
}

function webpDimensions(bytes: Buffer) {
  if (bytes.length < 30) return null;
  const chunk = bytes.subarray(12, 16).toString();
  if (chunk === "VP8X" && bytes.length >= 30) {
    return {
      width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16),
      height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16),
    };
  }
  return null;
}

function dimensionsFor(mime: SourceImageQuality["mimeType"], bytes: Buffer) {
  if (mime === "image/png") return pngDimensions(bytes);
  if (mime === "image/jpeg") return jpegDimensions(bytes);
  return webpDimensions(bytes);
}

/** Inspect dimensions and binary integrity; low-level persistence remains permissive for queue fixtures. */
export function inspectSourceImage(dataUrl: string): SourceImageQuality {
  const { mime, bytes } = parseDataUrl(dataUrl);
  const dimensions = dimensionsFor(mime, bytes);
  const reasons: string[] = [];
  if (!dimensions || dimensions.width < 512 || dimensions.height < 512)
    reasons.push("MIN_DIMENSIONS");
  if (dimensions && (dimensions.width > 8000 || dimensions.height > 8000))
    reasons.push("MAX_DIMENSIONS");
  return {
    mimeType: mime,
    bytes: bytes.length,
    width: dimensions?.width ?? 0,
    height: dimensions?.height ?? 0,
    passed: reasons.length === 0,
    reasons,
  };
}

export function persistSourceImage(
  dataUrl: string | undefined,
  taskId: string,
  root = uploadsDirectory(),
) {
  if (!dataUrl) return { path: null, expiresAt: null };
  const { mime, bytes } = parseDataUrl(dataUrl);
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

function hasActiveConsultationReference(path: string, now: number) {
  const rows = db()
    .prepare("SELECT created_at FROM consultations WHERE source_photo_path=?")
    .all(path) as Array<{ created_at: string }>;
  return rows.some((row) => {
    const createdAt = Date.parse(row.created_at);
    return !Number.isFinite(createdAt) || createdAt + CONSULTATION_RETENTION_MS > now;
  });
}

function hasJobReference(path: string, excludeJobId?: string) {
  const row = excludeJobId
    ? db()
        .prepare(
          "SELECT 1 FROM generation_job_payloads WHERE source_image_path=? AND job_id!=? LIMIT 1",
        )
        .get(path, excludeJobId)
    : db()
        .prepare(
          "SELECT 1 FROM generation_job_payloads WHERE source_image_path=? LIMIT 1",
        )
        .get(path);
  return Boolean(row);
}

/** Remove a source only when no active consultation or other queue job needs it. */
export function removeSourceImageIfUnreferenced(
  path: string | null,
  excludeJobId?: string,
  now = Date.now(),
) {
  if (!path || hasActiveConsultationReference(path, now) || hasJobReference(path, excludeJobId))
    return false;
  removeSourceImage(path);
  return true;
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
      if (hasActiveConsultationReference(row.source_image_path, now)) {
        const consultation = db()
          .prepare(
            "SELECT MAX(created_at) AS created_at FROM consultations WHERE source_photo_path=?",
          )
          .get(row.source_image_path) as { created_at?: string } | undefined;
        const createdAt = consultation?.created_at ? Date.parse(consultation.created_at) : NaN;
        if (Number.isFinite(createdAt)) {
          db()
            .prepare(
              "UPDATE generation_job_payloads SET source_expires_at=? WHERE job_id=?",
            )
            .run(createdAt + CONSULTATION_RETENTION_MS, row.job_id);
        }
        continue;
      }
      if (hasJobReference(row.source_image_path, row.job_id)) continue;
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
