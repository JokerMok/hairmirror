import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { requestGenerationCancellation } from "@/lib/generation-queue";
import { SESSION_COOKIE } from "@/lib/session";
import { getTaskForOwner } from "@/lib/task-store";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sessionId = request.cookies.get(SESSION_COOKIE)?.value;
  const user = getRequestUser(request);
  if (
    (!sessionId && !user) ||
    !getTaskForOwner(id, sessionId ?? "", user?.id ?? null)
  )
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const result = requestGenerationCancellation(id);
  return result.ok
    ? NextResponse.json(result)
    : NextResponse.json({ error: result.reason }, { status: 409 });
}
