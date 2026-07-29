import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  authCookieOptions,
  AUTH_COOKIE,
  checkAuthRateLimit,
  createAuthSession,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";
import { findUserByEmail, findUserByPhone } from "@/lib/database";

export const runtime = "nodejs";
const schema = z
  .object({
    identifier: z.string().trim().min(3).max(254).optional(),
    email: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    password: z.string().min(8).max(72),
  })
  .refine((data) => Boolean(data.identifier || data.email || data.phone));
const DUMMY_PASSWORD_HASH = hashPassword(
  "not-a-real-user-password",
  "00000000000000000000000000000000",
);

export async function POST(request: NextRequest) {
  const client =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!checkAuthRateLimit(`login:${client}`, 10, 15 * 60 * 1000))
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const identifier =
    parsed.data.identifier ?? parsed.data.email ?? parsed.data.phone ?? "";
  const row = identifier.includes("@")
    ? findUserByEmail(identifier)
    : findUserByPhone(identifier);
  const passwordValid = verifyPassword(
    parsed.data.password,
    row ? String(row.password_hash) : DUMMY_PASSWORD_HASH,
  );
  if (!row || row.status !== "active" || !passwordValid)
    return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
  const token = createAuthSession(String(row.id));
  const response = NextResponse.json({ authenticated: true });
  response.cookies.set(AUTH_COOKIE, token, authCookieOptions);
  return response;
}
