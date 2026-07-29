import { readFileSync } from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, getUserByToken } from "@/lib/auth";
import { db } from "@/lib/database";
import { SESSION_COOKIE } from "@/lib/session";

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
  const user = getUserByToken(request.cookies.get(AUTH_COOKIE)?.value);
  const sessionId = request.cookies.get(SESSION_COOKIE)?.value;
  if (
    (asset.user_id && user?.id !== asset.user_id) ||
    (!asset.user_id && sessionId !== asset.owner_session_id)
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
