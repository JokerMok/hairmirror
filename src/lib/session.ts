import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export const SESSION_COOKIE = "hair_session";
export const ADMIN_COOKIE = "hair_admin";

export type AdminCredentials = {
  username: string;
  password: string;
};

export function getOrCreateSession(request: NextRequest) {
  return request.cookies.get(SESSION_COOKIE)?.value ?? randomUUID();
}

export function getAdminCredentials(): AdminCredentials | null {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;
  return username && password ? { username, password } : null;
}

export function adminCookieValue(username: string, password: string) {
  return createHash("sha256")
    .update(username)
    .update("\0")
    .update(password)
    .digest("hex");
}

export function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isAdminRequest(request: NextRequest) {
  const credentials = getAdminCredentials();
  const value = request.cookies.get(ADMIN_COOKIE)?.value;
  return Boolean(
    credentials &&
      value &&
      safeEqual(
        value,
        adminCookieValue(credentials.username, credentials.password),
      ),
  );
}

export function isAdminCookieValue(value: string | undefined) {
  const credentials = getAdminCredentials();
  return Boolean(
    credentials &&
      value &&
      safeEqual(
        value,
        adminCookieValue(credentials.username, credentials.password),
      ),
  );
}

export function isInternalRequest(request: NextRequest) {
  const secret = process.env.INTERNAL_JOB_SECRET;
  const authorization = request.headers.get("authorization");
  return Boolean(
    secret &&
      authorization?.startsWith("Bearer ") &&
      safeEqual(authorization.slice(7), secret),
  );
}

export function safeRedirectUrl(request: Request, path: string) {
  if (!path.startsWith("/") || path.startsWith("//"))
    throw new Error("INVALID_REDIRECT_PATH");
  const configuredOrigin = process.env.PUBLIC_APP_URL?.trim();
  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  const origin = configuredOrigin
    ? new URL(configuredOrigin).origin
    : railwayDomain
      ? new URL(`https://${railwayDomain}`).origin
      : new URL(request.url).origin;
  const url = new URL(path, origin);
  if (url.hostname === "0.0.0.0" || url.hostname === "[::]")
    url.hostname = "127.0.0.1";
  return url;
}
