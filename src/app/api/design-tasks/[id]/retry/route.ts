import { after, NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import {
  processNextGenerationJob,
  retryFailedGeneration,
} from "@/lib/generation-queue";
import { allowGenerationRequest } from "@/lib/rate-limit";
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
  const identity = user ? `user:${user.id}` : `session:${sessionId}`;
  if (!allowGenerationRequest(request, identity))
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  try {
    const result = retryFailedGeneration(id, user);
    if (!result.ok)
      return NextResponse.json({ error: result.reason }, { status: 409 });
    after(() => processNextGenerationJob());
    return NextResponse.json({ queued: true }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && ["QUOTA_EXCEEDED", "ACCESS_REQUIRED"].includes(error.message)
            ? "PAYMENT_REQUIRED"
            : "RETRY_FAILED",
      },
      {
        status:
          error instanceof Error && ["QUOTA_EXCEEDED", "ACCESS_REQUIRED"].includes(error.message)
            ? 402
            : 500,
      },
    );
  }
}
