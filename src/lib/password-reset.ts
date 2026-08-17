import { createHash, randomBytes } from "node:crypto";
import { db, findUserByEmail } from "@/lib/database";
import { hashPassword } from "@/lib/auth";
import { SITE_URL } from "@/lib/site";

export const PASSWORD_RESET_MAX_AGE_MS = 30 * 60 * 1000;

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createPasswordResetToken(email: string) {
  const user = findUserByEmail(email);
  const userId = user?.id ? String(user.id) : "";
  const userEmail = user?.email ? String(user.email) : "";
  if (!user || String(user.status) !== "active" || !userId || !userEmail) return null;

  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  db().prepare("DELETE FROM password_reset_tokens WHERE user_id=? OR expires_at<=?").run(userId, now);
  db()
    .prepare(
      "INSERT INTO password_reset_tokens(id,user_id,token_hash,expires_at,created_at) VALUES(?,?,?,?,?)",
    )
    .run(
      crypto.randomUUID(),
      userId,
      tokenHash(token),
      now + PASSWORD_RESET_MAX_AGE_MS,
      new Date(now).toISOString(),
    );
  return { token, email: userEmail };
}

export function invalidatePasswordResetToken(token: string) {
  db().prepare("DELETE FROM password_reset_tokens WHERE token_hash=?").run(tokenHash(token));
}

export function resetPassword(token: string, newPassword: string) {
  const database = db();
  const row = database
    .prepare(
      "SELECT id,user_id FROM password_reset_tokens WHERE token_hash=? AND used_at IS NULL AND expires_at>?",
    )
    .get(tokenHash(token), Date.now()) as { id: string; user_id: string } | undefined;
  if (!row) return false;

  database.exec("BEGIN IMMEDIATE");
  try {
    database
      .prepare("UPDATE users SET password_hash=? WHERE id=? AND status='active'")
      .run(hashPassword(newPassword), row.user_id);
    database
      .prepare("UPDATE password_reset_tokens SET used_at=? WHERE id=?")
      .run(Date.now(), row.id);
    database.prepare("DELETE FROM auth_sessions WHERE user_id=?").run(row.user_id);
    database.exec("COMMIT");
    return true;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!apiKey || !from) return false;

  const resetUrl = new URL("/reset-password", `${SITE_URL}/`);
  resetUrl.searchParams.set("token", token);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Reset your HairMirror password",
      text: `Reset your HairMirror password within 30 minutes: ${resetUrl.toString()}`,
      html: `<p>Reset your HairMirror password within 30 minutes:</p><p><a href="${resetUrl.toString()}">Reset password</a></p>`,
    }),
  });
  if (!response.ok) {
    invalidatePasswordResetToken(token);
    return false;
  }
  return true;
}

export function passwordResetEmailConfigured() {
  return Boolean(
    process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM_EMAIL?.trim(),
  );
}
