import { readFileSync } from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, getUserByToken } from "@/lib/auth";
import { db } from "@/lib/database";
import { isAdminRequest, SESSION_COOKIE } from "@/lib/session";

export const runtime = "nodejs";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = (await params).id;
  if (!/^[0-9a-f-]{36}$/.test(id))
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const asset = db()
    .prepare("SELECT * FROM generated_assets WHERE id=? AND expires_at>?")
    .get(id, Date.now()) as Record<string, unknown> | undefined;
  if (!asset) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const admin = isAdminRequest(request);
  const user = admin
    ? null
    : getUserByToken(request.cookies.get(AUTH_COOKIE)?.value);
  const sessionId = request.cookies.get(SESSION_COOKIE)?.value;
  let consultationAccess = false;
  if (user) {
    const links = db()
      .prepare(
        "SELECT p.payload_json FROM generation_job_payloads p JOIN generation_jobs j ON j.id=p.job_id WHERE j.task_id=?",
      )
      .all(String(asset.task_id)) as Array<{ payload_json: string }>;
    for (const link of links) {
      try {
        const metadata = (JSON.parse(link.payload_json) as { queueMetadata?: { consultationId?: string } }).queueMetadata;
        if (!metadata?.consultationId) continue;
        const consultation = db()
          .prepare("SELECT salon_id,customer_user_id FROM consultations WHERE id=?")
          .get(metadata.consultationId) as
          | { salon_id?: string | null; customer_user_id?: string | null }
          | undefined;
        if (
          consultation?.customer_user_id === user.id ||
          (user.storeId && consultation?.salon_id === user.storeId)
        ) {
          consultationAccess = true;
          break;
        }
      } catch {
        // Ignore malformed metadata; direct ownership checks still apply.
      }
    }
  }
  if (
    !admin &&
    ((asset.user_id && user?.id !== asset.user_id && !consultationAccess) ||
      (!asset.user_id &&
        sessionId !== asset.owner_session_id &&
        !consultationAccess))
  )
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  try {
    return new NextResponse(readFileSync(String(asset.file_path)), {
      headers: {
        "content-type": String(asset.mime_type),
        "cache-control": "private, max-age=3600",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
}
