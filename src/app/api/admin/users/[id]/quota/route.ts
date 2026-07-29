import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdminRequest, safeRedirectUrl } from "@/lib/session";
import { updateUserQuota } from "@/lib/model-operations";

export const runtime = "nodejs";
const schema = z.object({
  limitCount: z.coerce.number().int().min(0).max(100_000),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdminRequest(request))
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const parsed = schema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success)
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const { id } = await params;
  const result = updateUserQuota(id, parsed.data.limitCount);
  if (!result.ok)
    return NextResponse.redirect(
      safeRedirectUrl(request, `/admin/users?error=${result.reason}`),
      303,
    );
  return NextResponse.redirect(
    safeRedirectUrl(request, "/admin/users?saved=1"),
    303,
  );
}
