import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  GOAL_LABELS,
  HAIRSTYLE_DIRECTION_COUNT,
  recommendTemplates,
} from "@/lib/catalog";
import { getTaskForOwner, listTasks } from "@/lib/task-store";
import type { StoredDesignTask } from "@/lib/types";
import { getOrCreateSession, SESSION_COOKIE } from "@/lib/session";
import { getRequestUser } from "@/lib/auth";
import { getActiveModelConfig } from "@/lib/model-operations";
import { allowGenerationRequest } from "@/lib/rate-limit";
import {
  enqueuePersistentGeneration,
  findIdempotentTask,
  processNextGenerationJob,
} from "@/lib/generation-queue";
import { persistSourceImage, removeSourceImage } from "@/lib/source-storage";
import { evaluateOperationalAlerts, notifyOpenAlerts } from "@/lib/operations";
import { billingProvider } from "@/lib/billing";
import { refreshGumroadLicense } from "@/lib/gumroad-billing";

export const runtime = "nodejs";
const schema = z.object({
  consent: z.literal(true),
  imageDataUrl: z
    .string()
    .max(12_000_000)
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/)
    .optional(),
  preferences: z.object({
    audience: z.enum(["masculine", "feminine", "neutral"]),
    currentLength: z.enum(["short", "medium", "long"]),
    targetLength: z.enum(["short", "medium", "long"]),
    goal: z.enum(["fresh", "younger", "volume", "professional", "fashion"]),
    texture: z.enum(["straight", "wavy", "curly", "coily"]).default("straight"),
    density: z.enum(["fine", "medium", "thick"]).default("medium"),
    faceShape: z
      .enum(["auto", "oval", "round", "square", "heart", "long"])
      .default("auto"),
    fringe: z.enum(["open", "avoid", "soft", "full"]).default("open"),
    parting: z.enum(["auto", "center", "side"]).default("auto"),
    chemical: z.boolean(),
    dailyMinutes: z.number().min(0).max(60),
  }),
});
const toPublicTask = (task: StoredDesignTask) => ({
  id: task.id,
  status: task.status,
  createdAt: task.createdAt,
  preferences: task.preferences,
  variants: task.variants,
  generationMode: task.generationMode,
  selectedVariantId: task.selectedVariantId,
  errorCode: task.errorCode,
});

export async function POST(request: NextRequest) {
  const sessionId = getOrCreateSession(request);
  const user = getRequestUser(request);
  const respond = (body: Record<string, unknown>, status: number) => {
    const response = NextResponse.json(body, {
      status,
      headers: { "cache-control": "no-store" },
    });
    response.cookies.set(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
    return response;
  };
  const identity = user ? `user:${user.id}` : `session:${sessionId}`;
  const idempotencyHeader = request.headers.get("idempotency-key");
  const validIdempotencyKey =
    idempotencyHeader && /^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyHeader)
      ? idempotencyHeader
      : null;
  if (validIdempotencyKey) {
    const existing = findIdempotentTask(identity, validIdempotencyKey);
    if (existing) {
      const task = getTaskForOwner(
        existing.taskId,
        sessionId,
        user?.id ?? null,
      );
      if (task)
        return respond(
          {
            task: toPublicTask(task),
            idempotencyKey: validIdempotencyKey,
            duplicate: true,
          },
          200,
        );
    }
  }
  if (!user) return respond({ error: "AUTH_REQUIRED" }, 401);
  if (!allowGenerationRequest(request, identity))
    return respond({ error: "RATE_LIMITED" }, 429);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return respond({ error: "INVALID_INPUT" }, 400);
  const active = getActiveModelConfig();
  if (!active) return respond({ error: "MODEL_UNAVAILABLE" }, 503);
  if (active.provider === "runninghub" && !parsed.data.imageDataUrl)
    return respond({ error: "SOURCE_IMAGE_REQUIRED" }, 400);
  if (user && billingProvider() === "gumroad")
    await refreshGumroadLicense(user.id);
  const idempotencyKey = validIdempotencyKey ?? crypto.randomUUID();
  const templates = recommendTemplates(parsed.data.preferences);
  if (templates.length !== HAIRSTYLE_DIRECTION_COUNT)
    return respond({ error: "RECOMMENDATIONS_UNAVAILABLE" }, 503);
  const taskId = crypto.randomUUID();
  let source: { path: string | null; expiresAt: number | null };
  try {
    source = persistSourceImage(parsed.data.imageDataUrl, taskId);
  } catch {
    return respond({ error: "INVALID_SOURCE_IMAGE" }, 400);
  }
  const task: StoredDesignTask = {
    id: taskId,
    status: "queued",
    createdAt: new Date().toISOString(),
    ownerSessionId: sessionId,
    userId: user?.id ?? null,
    preferences: parsed.data.preferences,
    generationMode:
      active.provider === "runninghub"
        ? "api"
        : active.provider === "local"
          ? "demo-fixed"
          : "mock",
    variants: templates.map((template) => ({
      id: crypto.randomUUID(),
      template,
      reason: `符合“${GOAL_LABELS[parsed.data.preferences.goal]}”诉求，并匹配目标发长。`,
    })),
  };
  let queued: ReturnType<typeof enqueuePersistentGeneration>;
  try {
    queued = enqueuePersistentGeneration({
      task,
      user,
      ownerKey: identity,
      idempotencyKey,
      sourceImagePath: source.path,
      sourceExpiresAt: source.expiresAt,
    });
  } catch (error) {
    removeSourceImage(source.path);
    const code = error instanceof Error ? error.message : "MODEL_UNAVAILABLE";
    return respond(
      {
        error:
          code === "ACCESS_REQUIRED" || code === "QUOTA_EXCEEDED"
            ? "PAYMENT_REQUIRED"
            : code === "COST_FUSE_OPEN"
              ? "COST_LIMIT_REACHED"
              : "MODEL_UNAVAILABLE",
      },
      code === "ACCESS_REQUIRED" || code === "QUOTA_EXCEEDED" ? 402 : 503,
    );
  }
  const publicTask = getTaskForOwner(
    queued.taskId,
    sessionId,
    user?.id ?? null,
  );
  if (!publicTask) return respond({ error: "QUEUE_WRITE_FAILED" }, 500);
  if (process.env.DISABLE_INLINE_WORKER !== "1")
    after(async () => {
      try {
        await processNextGenerationJob();
        evaluateOperationalAlerts();
        await notifyOpenAlerts();
      } catch {
        /* 持久化队列由独立 worker 接管 */
      }
    });
  return respond(
    {
      task: toPublicTask(publicTask),
      idempotencyKey,
      duplicate: queued.duplicate,
    },
    queued.duplicate ? 200 : 202,
  );
}

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get(SESSION_COOKIE)?.value;
  const user = getRequestUser(request);
  if (!sessionId && !user)
    return NextResponse.json(
      { tasks: [] },
      { headers: { "cache-control": "no-store" } },
    );
  const tasks = listTasks(sessionId ?? "", user?.id ?? null, 6).map(
    toPublicTask,
  );
  return NextResponse.json(
    { tasks },
    { headers: { "cache-control": "no-store" } },
  );
}
