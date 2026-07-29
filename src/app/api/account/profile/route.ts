import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  AUTH_COOKIE,
  checkAuthRateLimit,
  getUserByToken,
  updateAccountProfile,
} from "@/lib/auth";
import { safeRedirectUrl } from "@/lib/session";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().trim().min(2).max(30),
  storeName: z.string().trim().max(50).optional(),
  currentPassword: z.string().min(8).max(72),
});

export async function POST(request: NextRequest) {
  if (request.headers.get("sec-fetch-site") === "cross-site")
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const user = getUserByToken(request.cookies.get(AUTH_COOKIE)?.value);
  if (!user)
    return NextResponse.redirect(safeRedirectUrl(request, "/login"), 303);
  if (!checkAuthRateLimit(`profile:${user.id}`, 10, 60 * 60 * 1000))
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  const parsed = schema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success)
    return NextResponse.redirect(
      safeRedirectUrl(request, "/account?account_error=INVALID_INPUT"),
      303,
    );
  const result = updateAccountProfile({ userId: user.id, ...parsed.data });
  return NextResponse.redirect(
    safeRedirectUrl(
      request,
      result.ok
        ? "/account?profile=updated"
        : `/account?account_error=${result.reason}`,
    ),
    303,
  );
}
