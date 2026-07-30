import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function secretKey() {
  const configured = process.env.MODEL_SECRET_KEY;
  if (configured) {
    const key = Buffer.from(configured, "base64");
    if (key.length !== 32)
      throw new Error("MODEL_SECRET_KEY_MUST_BE_32_BYTES_BASE64");
    return key;
  }
  if (process.env.NODE_ENV === "production")
    throw new Error("MODEL_SECRET_KEY_REQUIRED_IN_PRODUCTION");
  const dataDir = join(process.cwd(), "data");
  mkdirSync(dataDir, { recursive: true });
  const path = join(dataDir, "model-secret.key");
  if (!existsSync(path))
    writeFileSync(path, randomBytes(32), { mode: 0o600, flag: "wx" });
  const key = readFileSync(path);
  if (key.length !== 32) throw new Error("INVALID_LOCAL_MODEL_SECRET_KEY");
  return key;
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSecret(payload: string) {
  const [version, iv, tag, encrypted] = payload.split(".");
  if (version !== "v1" || !iv || !tag || !encrypted)
    throw new Error("INVALID_ENCRYPTED_SECRET");
  // Reject non-canonical base64url input before decrypting. Without this
  // check, changing a trailing base64 character that only affects padding
  // bits can decode to the same bytes and bypass the tamper test.
  const canonical = (value: string) =>
    Buffer.from(value, "base64url").toString("base64url") === value;
  if (![iv, tag, encrypted].every(canonical))
    throw new Error("INVALID_ENCRYPTED_SECRET");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    secretKey(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function maskSecret(value: string) {
  return value.length <= 4 ? "••••" : `••••${value.slice(-4)}`;
}
