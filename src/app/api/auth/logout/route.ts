import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, deleteAuthSession } from "@/lib/auth";
import { safeRedirectUrl } from "@/lib/session";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  deleteAuthSession(request.cookies.get(AUTH_COOKIE)?.value);
  const acceptsHtml = (request.headers.get("accept") ?? "").includes(
    "text/html",
  );
  const response = acceptsHtml
    ? NextResponse.redirect(safeRedirectUrl(request, "/"), 303)
    : NextResponse.json({ authenticated: false });
  response.cookies.delete(AUTH_COOKIE);
  return response;
}
