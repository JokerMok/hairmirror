import { NextRequest, NextResponse } from "next/server";
import { cleanupExpiredAssets } from "@/lib/asset-retention";
import { recoverStaleGenerationJobs } from "@/lib/generation-queue";
import { evaluateOperationalAlerts, notifyOpenAlerts } from "@/lib/operations";
import { isInternalRequest } from "@/lib/session";
import { cleanupExpiredSourceImages } from "@/lib/source-storage";
import { maybeCreateScheduledBackup } from "@/lib/backup";
import { cleanupExpiredTasks } from "@/lib/task-store";
import { billingProvider } from "@/lib/billing";
import { refreshDueGumroadLicenses } from "@/lib/gumroad-billing";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (!isInternalRequest(request))
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const assets = cleanupExpiredAssets();
  const sources = cleanupExpiredSourceImages();
  const recovery = recoverStaleGenerationJobs();
  const tasks = cleanupExpiredTasks();
  const backup = await maybeCreateScheduledBackup();
  const billing =
    billingProvider() === "gumroad"
      ? await refreshDueGumroadLicenses()
      : { checked: 0, failed: 0 };
  const evaluation = evaluateOperationalAlerts();
  const notification = await notifyOpenAlerts();
  return NextResponse.json(
    {
      assets,
      sources,
      recovery,
      tasks,
      backup,
      billing,
      health: evaluation.health,
      alerts: evaluation.alerts.length,
      notification,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
