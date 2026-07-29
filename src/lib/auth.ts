import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import type { NextRequest } from "next/server";
import { db, getAuthUserById } from "./database";

export const AUTH_COOKIE = "hair_auth";
export const AUTH_MAX_AGE = 60 * 60 * 24 * 30;
const authAttempts = new Map<string, number[]>();

export function hashPassword(
  password: string,
  salt = randomBytes(16).toString("hex"),
) {
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, expectedHex] = stored.split(":");
  if (!salt || !expectedHex) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createAuthSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  db()
    .prepare("DELETE FROM auth_sessions WHERE expires_at <= ?")
    .run(Date.now());
  db()
    .prepare(
      "INSERT INTO auth_sessions(id,user_id,token_hash,expires_at,created_at) VALUES(?,?,?,?,?)",
    )
    .run(
      crypto.randomUUID(),
      userId,
      tokenHash(token),
      Date.now() + AUTH_MAX_AGE * 1000,
      new Date().toISOString(),
    );
  return token;
}

export function deleteAuthSession(token: string | undefined) {
  if (token)
    db()
      .prepare("DELETE FROM auth_sessions WHERE token_hash=?")
      .run(tokenHash(token));
}

export function getUserByToken(token: string | undefined) {
  if (!token) return null;
  const row = db()
    .prepare(
      "SELECT user_id FROM auth_sessions WHERE token_hash=? AND expires_at>?",
    )
    .get(tokenHash(token), Date.now()) as { user_id?: string } | undefined;
  if (!row?.user_id) return null;
  const user = getAuthUserById(row.user_id);
  return user?.status === "active" ? user : null;
}

export function getRequestUser(request: NextRequest) {
  return getUserByToken(request.cookies.get(AUTH_COOKIE)?.value);
}

export function updateAccountProfile(input: {
  userId: string;
  name: string;
  storeName?: string;
  currentPassword: string;
}) {
  const database = db();
  const row = database
    .prepare("SELECT password_hash,role FROM users WHERE id=?")
    .get(input.userId) as
    | { password_hash: string; role: string }
    | undefined;
  if (!row || !verifyPassword(input.currentPassword, row.password_hash))
    return { ok: false as const, reason: "INVALID_PASSWORD" };

  database.exec("BEGIN IMMEDIATE");
  try {
    database
      .prepare("UPDATE users SET name=? WHERE id=?")
      .run(input.name.trim(), input.userId);
    if (row.role === "store_owner" && input.storeName)
      database
        .prepare("UPDATE stores SET name=? WHERE owner_user_id=?")
        .run(input.storeName.trim(), input.userId);
    database.exec("COMMIT");
    return { ok: true as const };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function updateAccountPassword(input: {
  userId: string;
  currentPassword: string;
  newPassword: string;
}) {
  const database = db();
  const row = database
    .prepare("SELECT password_hash FROM users WHERE id=?")
    .get(input.userId) as { password_hash: string } | undefined;
  if (!row || !verifyPassword(input.currentPassword, row.password_hash))
    return { ok: false as const, reason: "INVALID_PASSWORD" };
  database
    .prepare("UPDATE users SET password_hash=? WHERE id=?")
    .run(hashPassword(input.newPassword), input.userId);
  database.prepare("DELETE FROM auth_sessions WHERE user_id=?").run(input.userId);
  return { ok: true as const };
}

export function checkAuthRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
) {
  const recent = (authAttempts.get(key) ?? []).filter(
    (time) => time > now - windowMs,
  );
  if (recent.length >= limit) return false;
  recent.push(now);
  authAttempts.set(key, recent);
  return true;
}

export const authCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: AUTH_MAX_AGE,
  path: "/",
};
