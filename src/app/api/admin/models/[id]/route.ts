import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdminRequest, safeRedirectUrl } from "@/lib/session";
import { setModelEnabled, updateModelRuntime } from "@/lib/model-operations";

export const runtime = "nodejs";
const schema = z.object({ enabled: z.boolean() });
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdminRequest(request))
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const id = (await params).id;
  if (!setModelEnabled(id, parsed.data.enabled))
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ updated: true });
}

const runtimeSchema = z.object({
  apiKey: z.string().max(500).optional(),
  enabled: z.preprocess(
    (value) => value ?? false,
    z
      .literal("on")
      .transform(() => true)
      .or(z.boolean()),
  ),
  priority: z.coerce.number().int().min(1).max(999),
  timeoutMs: z.coerce.number().int().min(1000).max(600000),
  costPerImageYuan: z.coerce.number().min(0).max(100),
});
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdminRequest(request))
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const parsed = runtimeSchema.safeParse(
    Object.fromEntries(await request.formData()),
  );
  if (!parsed.success)
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const id = (await params).id;
  const { costPerImageYuan, ...input } = parsed.data;
  const costPerImageMicros = Math.round(costPerImageYuan * 1_000_000);
  if (!updateModelRuntime(id, { ...input, costPerImageMicros }))
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.redirect(
    safeRedirectUrl(request, `/admin/models/${id}?saved=1`),
    303,
  );
}
