import { after, NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { db } from "@/lib/database";
import {
  getPublicConsultation,
} from "@/lib/consultation-access";
import {
  assertRecommendationBelongsToConsultation,
  ConsultationDomainError,
} from "@/lib/consultation-domain";
import {
  actorForUser,
  analyze,
  archive,
  enqueueConsultationGeneration,
  requireConsultation,
  selectRecommendation,
} from "../_repository";
import {
  listConsultationRecommendationJobs,
  processNextGenerationJob,
  requestConsultationRecommendationCancellation,
  retryConsultationRecommendation,
} from "@/lib/generation-queue";
import {
  hasValidHairColorPreference,
  normalizeConsultationBrief,
  type ConsultationBrief,
  type HairGoal,
  type HairLength,
} from "@/lib/types";

export const runtime = "nodejs";

const knownQueueErrors = new Set([
  "NO_ACTIVE_MODEL",
  "ACCESS_REQUIRED",
  "QUOTA_EXCEEDED",
  "COST_FUSE_OPEN",
  "NOT_FOUND",
  "NOT_RETRYABLE",
  "TERMINAL",
  "SOURCE_EXPIRED",
  "RESULT_IMAGE_MISSING",
]);

function fail(error: unknown) {
  const raw = error instanceof Error ? error.message : "INVALID_CONSULTATION_INPUT";
  const code = error instanceof ConsultationDomainError
    ? error.code
    : knownQueueErrors.has(raw)
      ? raw
      : "INVALID_CONSULTATION_INPUT";
  const status = code === "CONSULTATION_NOT_FOUND"
    ? 404
    : code === "CONSULTATION_FORBIDDEN"
      ? 403
      : code === "NO_ACTIVE_MODEL"
        ? 503
        : ["ACCESS_REQUIRED", "QUOTA_EXCEEDED"].includes(code)
          ? 402
          : ["NOT_FOUND", "NOT_RETRYABLE", "TERMINAL", "SOURCE_EXPIRED", "RESULT_IMAGE_MISSING"].includes(code)
            ? 409
            : 400;
  const publicCode = code === "NO_ACTIVE_MODEL" ? "MODEL_UNAVAILABLE" : code;
  return NextResponse.json(
    { error: publicCode },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function responseFor(id: string, actor: ReturnType<typeof actorForUser>) {
  const consultation = getPublicConsultation(db(), id, actor);
  if (!consultation) throw new ConsultationDomainError("CONSULTATION_NOT_FOUND");
  return {
    consultation: {
      ...consultation,
      generationJobs: listConsultationRecommendationJobs(id),
    },
  };
}

function readConsultationBrief(value: unknown): ConsultationBrief | undefined {
  if (!value || typeof value !== "object") return undefined;
  const brief = value as Record<string, unknown>;
  const lengths: HairLength[] = ["short", "medium", "long"];
  const goals: HairGoal[] = ["fresh", "younger", "volume", "professional", "fashion"];
  const currentLength = lengths.includes(brief.currentLength as HairLength) ? brief.currentLength as HairLength : "medium";
  const targetLength = lengths.includes(brief.targetLength as HairLength) ? brief.targetLength as HairLength : "medium";
  const goal = goals.includes(brief.goal as HairGoal) ? brief.goal as HairGoal : "fresh";
  const dailyMinutes = typeof brief.dailyMinutes === "number" && Number.isFinite(brief.dailyMinutes)
    ? Math.max(0, Math.min(30, Math.round(brief.dailyMinutes / 5) * 5))
    : 10;
  const normalized = normalizeConsultationBrief({
    ...brief,
    currentLength,
    targetLength,
    goal,
    dailyMinutes,
  });
  if (!hasValidHairColorPreference(normalized)) throw new Error("INVALID_CONSULTATION_INPUT");
  return normalized;
}

function scheduleInlineWorker() {
  if (process.env.DISABLE_INLINE_WORKER === "1") return;
  after(async () => {
    for (let index = 0; index < 3; index += 1) {
      const result = await processNextGenerationJob();
      if (result.status === "idle") break;
    }
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = getRequestUser(request);
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  try {
    const id = (await params).id;
    const actor = actorForUser(user);
    requireConsultation(id, actor);
    return NextResponse.json(responseFor(id, actor), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = getRequestUser(request);
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  try {
    const id = (await params).id;
    const actor = actorForUser(user);
    const item = requireConsultation(id, actor);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "";
    let status = 200;

    if (action === "analyze") {
      await analyze(item, {
        imageId: typeof body.imageId === "string" ? body.imageId : undefined,
        role: actor.role === "consumer" ? "consumer" : "stylist",
        brief: readConsultationBrief(body.brief),
      });
    } else if (action === "generate") {
      enqueueConsultationGeneration(item, user);
      status = 202;
      scheduleInlineWorker();
    } else if (action === "retry" || action === "cancel") {
      const recommendationId = String(body.recommendationId ?? "");
      assertRecommendationBelongsToConsultation(
        item.recommendations.find((recommendation) => recommendation.id === recommendationId),
        id,
      );
      const result = action === "retry"
        ? retryConsultationRecommendation(id, recommendationId, user)
        : requestConsultationRecommendationCancellation(id, recommendationId);
      if (!result.ok) throw new Error(result.reason);
      if (action === "retry") {
        status = 202;
        scheduleInlineWorker();
      }
    } else if (action === "archive") {
      archive(item);
    } else if (action === "select") {
      selectRecommendation(item, String(body.selectedRecommendationId ?? ""));
    } else {
      throw new ConsultationDomainError("INVALID_CONSULTATION_INPUT");
    }

    return NextResponse.json(responseFor(id, actor), {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return fail(error);
  }
}
