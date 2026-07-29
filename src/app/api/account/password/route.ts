import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  AUTH_COOKIE,
  authCookieOptions,
  checkAuthRateLimit,
  createAuthSession,
  getUserByToken,
  updateAccountPassword,
} from "@/lib/auth";
import { safeRedirectUrl } from "@/lib/session";

export const runtime = "nodejs";

const schema = z
  .object({
    currentPassword: z.string().min(8).max(72),
    newPassword: z.string().min(8).max(72),
    confirmPassword: z.string().min(8).max(72),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "PASSWORD_MISMATCH",
  });

export async function POST(request: NextRequest) {
  if (request.headers.get("sec-fetch-site") === "cross-site")
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const user = getUserByToken(request.cookies.get(AUTH_COOKIE)?.value);
  if (!user)
    return NextResponse.redirect(safeRedirectUrl(request, "/login"), 303);
  if (!checkAuthRateLimit(`password:${user.id}`, 5, 60 * 60 * 1000))
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  const parsed = schema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success)
    return NextResponse.redirect(
      safeRedirectUrl(request, "/account?account_error=PASSWORD_MISMATCH"),
      303,
    );
  const result = updateAccountPassword({
    userId: user.id,
    currentPassword: parsed.data.currentPassword,
    newPassword: parsed.data.newPassword,
  });
  if (!result.ok)
    return NextResponse.redirect(
      safeRedirectUrl(request, `/account?account_error=${result.reason}`),
      303,
    );
  const response = NextResponse.redirect(
    safeRedirectUrl(request, "/account?password=updated"),
    303,
  );
  response.cookies.set(
    AUTH_COOKIE,
    createAuthSession(user.id),
    authCookieOptions,
  );
  return response;
}
