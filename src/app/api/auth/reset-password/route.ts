import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkAuthRateLimit } from "@/lib/auth";
import { resetPassword } from "@/lib/password-reset";

export const runtime = "nodejs";

const schema = z.object({
  token: z.string().min(20).max(256),
  password: z.string().min(8).max(72),
});

export async function POST(request: NextRequest) {
  const client =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!checkAuthRateLimit(`password-reset-submit:${client}`, 10, 60 * 60 * 1000))
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  if (!resetPassword(parsed.data.token, parsed.data.password))
    return NextResponse.json({ error: "INVALID_RESET_TOKEN" }, { status: 400 });
  return NextResponse.json({ reset: true });
}
