import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, getUserByToken } from "@/lib/auth";
import { billingProvider, billingState } from "@/lib/billing";
import {
  createPaddleTransaction,
  paddlePurchaseAllowed,
  type PaddlePurchaseKey,
} from "@/lib/paddle-billing";

export const runtime = "nodejs";
function appUrl(request: NextRequest) {
  return (process.env.PUBLIC_APP_URL ?? request.nextUrl.origin).replace(/\/$/, "");
}

export async function POST(request: NextRequest) {
  if (request.headers.get("sec-fetch-site") === "cross-site")
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (billingProvider() !== "paddle")
    return NextResponse.json({ error: "PADDLE_BILLING_DISABLED" }, { status: 404 });
  const user = getUserByToken(request.cookies.get(AUTH_COOKIE)?.value);
  if (!user)
    return NextResponse.redirect(new URL("/login?next=/pricing", appUrl(request)), 303);
  const contentType = request.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? await request.json().catch(() => ({}))
    : Object.fromEntries(await request.formData());
  const purchase = String(body.purchase ?? body.plan ?? "") as PaddlePurchaseKey;
  if (
    !["personal_pack", "personal_plus", "salon_pro"].includes(purchase) ||
    !paddlePurchaseAllowed(user, purchase)
  )
    return NextResponse.json({ error: "PLAN_NOT_ALLOWED" }, { status: 400 });
  if (purchase !== "personal_pack") {
    const state = billingState(user.id);
    if (state && ["active", "trialing", "past_due"].includes(state.status))
      return NextResponse.redirect(new URL("/account?billing=existing", appUrl(request)), 303);
  }
  try {
    const transaction = await createPaddleTransaction(user, purchase);
    return NextResponse.redirect(
      new URL(`/billing/checkout?transaction=${encodeURIComponent(transaction.id)}`, appUrl(request)),
      303,
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "CHECKOUT_UNAVAILABLE";
    const safe = ["BILLING_NOT_CONFIGURED", "BILLING_EMAIL_REQUIRED"].includes(code)
      ? code
      : "CHECKOUT_UNAVAILABLE";
    return NextResponse.redirect(
      new URL(`/pricing?billing_error=${encodeURIComponent(safe)}`, appUrl(request)),
      303,
    );
  }
}
