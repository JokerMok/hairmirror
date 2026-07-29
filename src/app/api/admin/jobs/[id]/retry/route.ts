import { after, NextRequest, NextResponse } from "next/server";
import { db, getAuthUserById } from "@/lib/database";
import {
  processNextGenerationJob,
  retryFailedGeneration,
} from "@/lib/generation-queue";
import { isAdminRequest, safeRedirectUrl } from "@/lib/session";
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdminRequest(request))
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await params;
  const job = db()
    .prepare("SELECT task_id,user_id FROM generation_jobs WHERE id=?")
    .get(id) as { task_id?: string; user_id?: string } | undefined;
  if (!job?.task_id)
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const user = job.user_id ? getAuthUserById(job.user_id) : null;
  const result = retryFailedGeneration(job.task_id, user);
  if (!result.ok)
    return NextResponse.json({ error: result.reason }, { status: 409 });
  after(() => processNextGenerationJob());
  return NextResponse.redirect(
    safeRedirectUrl(request, "/admin/operations"),
    303,
  );
}
