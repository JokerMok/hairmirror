import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addFeedback } from "@/lib/task-store";
import { SESSION_COOKIE } from "@/lib/session";
import { getRequestUser } from "@/lib/auth";

const schema = z.object({
  taskId: z.string().uuid(),
  variantId: z.string().uuid(),
  helpful: z.boolean(),
  issue: z.string().max(100).optional(),
});
export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const sessionId = request.cookies.get(SESSION_COOKIE)?.value;
  const user = getRequestUser(request);
  if (!sessionId && !user)
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const saved = addFeedback(
    {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...parsed.data,
    },
    sessionId ?? "",
    user?.id ?? null,
  );
  if (!saved) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ saved: true });
}
