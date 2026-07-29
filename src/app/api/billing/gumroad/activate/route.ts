import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_COOKIE, checkAuthRateLimit, getUserByToken } from "@/lib/auth";
import {
  BILLING_PLANS,
  billingProvider,
} from "@/lib/billing";
import {
  activateGumroadLicense,
  activateGumroadPack,
} from "@/lib/gumroad-billing";
import { safeRedirectUrl } from "@/lib/session";

export const runtime = "nodejs";

const schema = z.object({
  plan: z.enum(["personal_pack", "salon_pro"]),
  licenseKey: z.string().trim().min(16).max(256),
});

const exposedErrors = new Set([
  "INVALID_LICENSE",
  "PRODUCT_MISMATCH",
  "EMAIL_MISMATCH",
  "CURRENCY_MISMATCH",
  "SUBSCRIPTION_REQUIRED",
  "LICENSE_INACTIVE",
  "LICENSE_ALREADY_BOUND",
  "GUMROAD_PRODUCT_NOT_CONFIGURED",
  "GUMROAD_UNAVAILABLE",
]);

export async function POST(request: NextRequest) {
  if (request.headers.get("sec-fetch-site") === "cross-site")
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (billingProvider() !== "gumroad")
    return NextResponse.json({ error: "GUMROAD_DISABLED" }, { status: 404 });
  const user = getUserByToken(request.cookies.get(AUTH_COOKIE)?.value);
  if (!user)
    return NextResponse.redirect(
      safeRedirectUrl(request, "/login?next=/account?activate=1"),
      303,
    );
  if (!checkAuthRateLimit(`gumroad:${user.id}`, 10, 60 * 60 * 1000))
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });

  const contentType = request.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? await request.json().catch(() => ({}))
    : Object.fromEntries(await request.formData());
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const plan = parsed.data.plan;
  if (
    (plan === "personal_pack" && user.role !== "personal") ||
    (plan === "salon_pro" && !BILLING_PLANS.salon_pro.roles.includes(user.role))
  )
    return NextResponse.json({ error: "PLAN_NOT_ALLOWED" }, { status: 400 });

  try {
    const state =
      plan === "personal_pack"
        ? await activateGumroadPack(user, parsed.data.licenseKey)
        : await activateGumroadLicense(user, "salon_pro", parsed.data.licenseKey);
    if (contentType.includes("application/json"))
      return NextResponse.json({ state });
    return NextResponse.redirect(
      safeRedirectUrl(request, "/account?billing=activated"),
      303,
    );
  } catch (error) {
    const raw = error instanceof Error ? error.message : "ACTIVATION_FAILED";
    const code = exposedErrors.has(raw) ? raw : "ACTIVATION_FAILED";
    if (contentType.includes("application/json"))
      return NextResponse.json(
        { error: code },
        { status: raw === "GUMROAD_UNAVAILABLE" ? 503 : 400 },
      );
    return NextResponse.redirect(
      safeRedirectUrl(
        request,
        `/account?activate=1&billing_error=${encodeURIComponent(code)}`,
      ),
      303,
    );
  }
}
