import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  adminCookieValue,
  safeEqual,
  safeRedirectUrl,
} from "@/lib/session";

export async function POST(request: Request) {
  const secret = process.env.ADMIN_ACCESS_KEY;
  const body = await request.formData();
  const key = body.get("key");
  if (!secret || typeof key !== "string" || !safeEqual(key, secret))
    return NextResponse.redirect(
      safeRedirectUrl(request, "/admin?error=invalid"),
      303,
    );
  const response = NextResponse.redirect(
    safeRedirectUrl(request, "/admin"),
    303,
  );
  response.cookies.set(ADMIN_COOKIE, adminCookieValue(secret), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 8,
    path: "/",
  });
  return response;
}
