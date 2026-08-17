import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkAuthRateLimit } from "@/lib/auth";
import {
  createPasswordResetToken,
  passwordResetEmailConfigured,
  sendPasswordResetEmail,
} from "@/lib/password-reset";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export async function POST(request: NextRequest) {
  const client =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!checkAuthRateLimit(`password-reset:${client}`, 5, 60 * 60 * 1000))
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  if (!passwordResetEmailConfigured())
    return NextResponse.json({ error: "RESET_NOT_CONFIGURED" }, { status: 503 });

  const reset = createPasswordResetToken(parsed.data.email);
  if (reset) await sendPasswordResetEmail(reset.email, reset.token);
  return NextResponse.json({ sent: true });
}
