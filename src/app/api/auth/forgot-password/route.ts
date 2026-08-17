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
  if (reset) {
    try {
      const sent = await sendPasswordResetEmail(reset.email, reset.token);
      if (!sent)
        return NextResponse.json({ error: "RESET_DELIVERY_FAILED" }, { status: 502 });
    } catch {
      return NextResponse.json({ error: "RESET_DELIVERY_FAILED" }, { status: 502 });
    }
  }
  return NextResponse.json({ sent: true });
}
