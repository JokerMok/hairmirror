import { NextRequest, NextResponse } from "next/server";
import { deleteTask } from "@/lib/task-store";
import { getTaskForOwner } from "@/lib/task-store";
import { SESSION_COOKIE } from "@/lib/session";
import { getRequestUser } from "@/lib/auth";
import { requestGenerationCancellation } from "@/lib/generation-queue";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sessionId = request.cookies.get(SESSION_COOKIE)?.value;
  const user = getRequestUser(request);
  if (!sessionId && !user)
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const task = getTaskForOwner(id, sessionId ?? "", user?.id ?? null);
  if (!task) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const publicTask = {
    id: task.id,
    status: task.status,
    createdAt: task.createdAt,
    preferences: task.preferences,
    variants: task.variants,
    generationMode: task.generationMode,
    selectedVariantId: task.selectedVariantId,
    errorCode: task.errorCode,
  };
  return NextResponse.json(
    { task: publicTask },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function DELETE(
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
  requestGenerationCancellation(id);
  if (!deleteTask(id, sessionId ?? "", user?.id ?? null))
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
