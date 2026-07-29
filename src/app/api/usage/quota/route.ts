import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { accessSummary } from "@/lib/entitlements";
import { getOrCreateSession, SESSION_COOKIE } from "@/lib/session";

export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const user = getRequestUser(request);
  const sessionId = getOrCreateSession(request);
  const response = NextResponse.json(
    { access: accessSummary(user, sessionId) },
    { headers: { "cache-control": "no-store" } },
  );
  if (!request.cookies.get(SESSION_COOKIE))
    response.cookies.set(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  return response;
}
