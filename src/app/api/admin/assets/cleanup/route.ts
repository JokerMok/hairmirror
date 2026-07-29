import { NextRequest, NextResponse } from "next/server";
import { cleanupExpiredAssets } from "@/lib/asset-retention";
import { isAdminRequest } from "@/lib/session";
import { safeRedirectUrl } from "@/lib/session";
import { cleanupExpiredSourceImages } from "@/lib/source-storage";
import { recoverStaleGenerationJobs } from "@/lib/generation-queue";
import { evaluateOperationalAlerts, notifyOpenAlerts } from "@/lib/operations";
import { cleanupExpiredTasks } from "@/lib/task-store";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request))
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const result = {
    assets: cleanupExpiredAssets(),
    sources: cleanupExpiredSourceImages(),
    recovery: recoverStaleGenerationJobs(),
    tasks: cleanupExpiredTasks(),
    evaluation: evaluateOperationalAlerts(),
  };
  await notifyOpenAlerts();
  if (
    request.headers
      .get("content-type")
      ?.includes("application/x-www-form-urlencoded")
  )
    return NextResponse.redirect(
      safeRedirectUrl(request, "/admin/operations"),
      303,
    );
  return NextResponse.json(result, {
    headers: { "cache-control": "no-store" },
  });
}
