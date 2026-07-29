import { NextRequest, NextResponse } from "next/server";
import {
  processNextGenerationJob,
  recoverStaleGenerationJobs,
} from "@/lib/generation-queue";
import { evaluateOperationalAlerts, notifyOpenAlerts } from "@/lib/operations";
import { isInternalRequest } from "@/lib/session";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (!isInternalRequest(request))
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { limit?: number };
  const limit = Math.min(10, Math.max(1, Number(body.limit) || 1));
  const recovery = recoverStaleGenerationJobs();
  const results = [];
  for (let index = 0; index < limit; index += 1) {
    const result = await processNextGenerationJob();
    results.push(result);
    if (result.status === "idle") break;
  }
  const evaluation = evaluateOperationalAlerts();
  const notification = await notifyOpenAlerts();
  return NextResponse.json(
    { recovery, results, health: evaluation.health, notification },
    { headers: { "cache-control": "no-store" } },
  );
}
