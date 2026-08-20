import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  adminCookieValue,
  getAdminCredentials,
  safeEqual,
  safeRedirectUrl,
} from "@/lib/session";

export async function POST(request: Request) {
  const credentials = getAdminCredentials();
  const body = await request.formData();
  const username = body.get("username");
  const password = body.get("password");
  if (
    !credentials ||
    typeof username !== "string" ||
    typeof password !== "string" ||
    !safeEqual(username, credentials.username) ||
    !safeEqual(password, credentials.password)
  )
    return NextResponse.redirect(
      safeRedirectUrl(request, "/admin?error=invalid"),
      303,
    );
  const response = NextResponse.redirect(
    safeRedirectUrl(request, "/admin"),
    303,
  );
  response.cookies.set(
    ADMIN_COOKIE,
    adminCookieValue(credentials.username, credentials.password),
    {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 8,
      path: "/",
    },
  );
  return response;
}
