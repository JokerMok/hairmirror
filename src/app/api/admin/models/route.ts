import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdminRequest, safeRedirectUrl } from "@/lib/session";
import { listModelConfigs, saveModelConfig } from "@/lib/model-operations";

export const runtime = "nodejs";
const schema = z
  .object({
    name: z.string().trim().min(2).max(50),
    provider: z.string().trim().min(2).max(30),
    model: z.string().trim().min(1).max(80),
    endpoint: z.string().url().optional().or(z.literal("")),
    apiKey: z.string().max(500).optional(),
    enabled: z.preprocess(
      (value) => value ?? false,
      z
        .union([z.boolean(), z.literal("on")])
        .transform((value) => value === true || value === "on"),
    ),
    priority: z.coerce.number().int().min(1).max(999),
    timeoutMs: z.coerce.number().int().min(1000).max(600000),
    costPerImageYuan: z.coerce.number().min(0).max(100),
    currency: z.enum(["CNY", "USD"]),
  })
  .transform(({ costPerImageYuan, ...input }) => ({
    ...input,
    costPerImageMicros: Math.round(costPerImageYuan * 1_000_000),
  }));

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request))
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  return NextResponse.json(
    { models: listModelConfigs() },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request))
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const contentType = request.headers.get("content-type") ?? "";
  const input = contentType.includes("application/json")
    ? await request.json().catch(() => null)
    : Object.fromEntries(await request.formData());
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const id = saveModelConfig(parsed.data);
  if (!contentType.includes("application/json"))
    return NextResponse.redirect(
      safeRedirectUrl(request, "/admin/models?created=1"),
      303,
    );
  return NextResponse.json({ id }, { status: 201 });
}
