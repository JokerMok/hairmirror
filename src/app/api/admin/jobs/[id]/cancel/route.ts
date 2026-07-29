import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/database";
import { requestGenerationCancellation } from "@/lib/generation-queue";
import { isAdminRequest, safeRedirectUrl } from "@/lib/session";
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdminRequest(request))
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await params;
  const job = db()
    .prepare("SELECT task_id FROM generation_jobs WHERE id=?")
    .get(id) as { task_id?: string } | undefined;
  if (!job?.task_id)
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  requestGenerationCancellation(job.task_id);
  return NextResponse.redirect(
    safeRedirectUrl(request, "/admin/operations"),
    303,
  );
}
