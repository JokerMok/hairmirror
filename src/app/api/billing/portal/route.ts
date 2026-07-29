import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, getUserByToken } from "@/lib/auth";
import { billingProvider } from "@/lib/billing";
import { db } from "@/lib/database";
import { paddleClient } from "@/lib/paddle-billing";

export async function POST(request: NextRequest) {
  if (request.headers.get("sec-fetch-site") === "cross-site")
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (billingProvider() !== "paddle")
    return NextResponse.json({ error: "PADDLE_BILLING_DISABLED" }, { status: 404 });
  const user = getUserByToken(request.cookies.get(AUTH_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const row = db()
    .prepare("SELECT customer_id FROM paddle_customers WHERE user_id=?")
    .get(user.id) as { customer_id?: string } | undefined;
  if (!row?.customer_id)
    return NextResponse.json({ error: "NO_BILLING_ACCOUNT" }, { status: 404 });
  const session = await paddleClient().customerPortalSessions.create(
    row.customer_id,
    [],
  );
  return NextResponse.redirect(session.urls.general.overview, 303);
}
