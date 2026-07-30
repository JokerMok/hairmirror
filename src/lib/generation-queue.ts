import { existsSync } from "node:fs";
import type { AuthUser } from "./database";
import { db } from "./database";
import { generateHairstyleImages } from "./generation-provider";
import {
  getActiveModelConfig,
  getModelRuntimeById,
} from "./model-operations";
import {
  finalizeGenerationAccess,
  reserveGenerationAccess,
} from "./entitlements";
import { recordOperationalEvent } from "./operations";
import { removeAssetsForTask } from "./asset-retention";
import { readSourceImage, removeSourceImage } from "./source-storage";
import type { StoredDesignTask } from "./types";

type Row = Record<string, unknown>;
export type QueueMetadata = {
  consultationId?: string;
  recommendationId?: string;
};
type QueuePayload = StoredDesignTask & { queueMetadata?: QueueMetadata };
type ClaimedJob = {
  id: string;
  taskId: string;
  userId: string | null;
  modelConfigId: string;
  attempts: number;
  maxAttempts: number;
  ownerSessionId: string;
  payload: QueuePayload;
  sourceImagePath: string | null;
  lockToken: string;
};
const positiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};
function estimatedGenerationCost(
  modelCostPerImage: number,
  variantCount: number,
) {
  const fallback = positiveInteger(
    process.env.GENERATION_DEFAULT_COST_PER_IMAGE_MICROS,
    70_000,
  );
  return Math.max(modelCostPerImage, fallback) * variantCount;
}
function assertGlobalCostFuse(additionalMicros: number, now = Date.now()) {
  const limit = positiveInteger(
    process.env.GENERATION_GLOBAL_DAILY_COST_LIMIT_MICROS,
    20_000_000,
  );
  const since = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const row = db()
    .prepare(
      "SELECT COALESCE(SUM(CASE WHEN status IN ('queued','processing') THEN estimated_cost_micros ELSE actual_cost_micros END),0) AS committed FROM generation_jobs WHERE queued_at>=?",
    )
    .get(since) as { committed: number };
  if (Number(row.committed) + additionalMicros > limit)
    throw new Error("COST_FUSE_OPEN");
}

export function findIdempotentTask(ownerKey: string, idempotencyKey: string) {
  const row = db()
    .prepare(
      "SELECT j.task_id,p.job_id FROM generation_job_payloads p JOIN generation_jobs j ON j.id=p.job_id WHERE p.owner_key=? AND p.idempotency_key=?",
    )
    .get(ownerKey, idempotencyKey) as
    | { task_id: string; job_id: string }
    | undefined;
  return row ? { taskId: row.task_id, jobId: row.job_id } : null;
}

export function enqueuePersistentGeneration(input: {
  task: StoredDesignTask;
  user: AuthUser | null;
  ownerKey: string;
  idempotencyKey: string;
  sourceImagePath: string | null;
  sourceExpiresAt: number | null;
  metadata?: QueueMetadata;
}) {
  const existing = findIdempotentTask(input.ownerKey, input.idempotencyKey);
  if (existing) {
    removeSourceImage(input.sourceImagePath);
    return { ...existing, duplicate: true };
  }
  const model = getActiveModelConfig();
  if (!model) {
    removeSourceImage(input.sourceImagePath);
    throw new Error("NO_ACTIVE_MODEL");
  }
  const database = db();
  const now = new Date().toISOString();
  const nowMs = Date.now();
  const jobId = crypto.randomUUID();
  const maxAttempts = positiveInteger(process.env.GENERATION_MAX_ATTEMPTS, 3);
  const estimatedCost = estimatedGenerationCost(
    model.costPerImageMicros,
    input.task.variants.length,
  );
  const payload: QueuePayload = input.metadata
    ? { ...input.task, queueMetadata: input.metadata }
    : input.task;
  database.exec("BEGIN IMMEDIATE");
  try {
    assertGlobalCostFuse(estimatedCost, nowMs);
    database
      .prepare(
        "INSERT INTO design_tasks(id,owner_session_id,user_id,status,preferences_json,variants_json,generation_mode,created_at) VALUES(?,?,?,?,?,?,?,?)",
      )
      .run(
        input.task.id,
        input.task.ownerSessionId,
        input.task.userId,
        "processing",
        JSON.stringify(input.task.preferences),
        JSON.stringify(input.task.variants),
        input.task.generationMode,
        input.task.createdAt,
      );
    database
      .prepare(
        "INSERT INTO generation_jobs(id,task_id,user_id,model_config_id,status,variant_count,estimated_cost_micros,actual_cost_micros,error_code,attempts,queued_at) VALUES(?,?,?,?, 'queued',?,?,0,NULL,0,?)",
      )
      .run(
        jobId,
        input.task.id,
        input.user?.id ?? null,
        model.id,
        input.task.variants.length,
        estimatedCost,
        now,
      );
    reserveGenerationAccess({
      jobId,
      user: input.user,
      sessionId: input.task.ownerSessionId,
      variantCount: input.task.variants.length,
      now,
    });
    database
      .prepare(
        "INSERT INTO generation_job_payloads(job_id,owner_session_id,owner_key,idempotency_key,payload_json,source_image_path,source_expires_at,available_at,max_attempts) VALUES(?,?,?,?,?,?,?,?,?)",
      )
      .run(
        jobId,
        input.task.ownerSessionId,
        input.ownerKey,
        input.idempotencyKey,
        JSON.stringify(payload),
        input.sourceImagePath,
        input.sourceExpiresAt,
        nowMs,
        maxAttempts,
      );
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    const duplicate = findIdempotentTask(input.ownerKey, input.idempotencyKey);
    if (duplicate) {
      removeSourceImage(input.sourceImagePath);
      return { ...duplicate, duplicate: true };
    }
    removeSourceImage(input.sourceImagePath);
    throw error;
  }
  recordOperationalEvent("info", "job.queued", "生成任务已入队", jobId, {
    taskId: input.task.id,
  });
  return { taskId: input.task.id, jobId, duplicate: false };
}

/** Enqueue one generation job per AI recommendation while preserving consultation linkage. */
export function enqueueConsultationRecommendations(input: {
  consultationId: string;
  user: AuthUser | null;
  ownerKey: string;
  recommendations: Array<{
    recommendationId: string;
    task: StoredDesignTask;
    sourceImagePath: string | null;
    sourceExpiresAt: number | null;
    idempotencyKey?: string;
  }>;
}) {
  return input.recommendations.map((recommendation) =>
    enqueuePersistentGeneration({
      task: recommendation.task,
      user: input.user,
      ownerKey: input.ownerKey,
      idempotencyKey:
        recommendation.idempotencyKey ??
        `${input.consultationId}:${recommendation.recommendationId}`,
      sourceImagePath: recommendation.sourceImagePath,
      sourceExpiresAt: recommendation.sourceExpiresAt,
      metadata: {
        consultationId: input.consultationId,
        recommendationId: recommendation.recommendationId,
      },
    }),
  );
}

export type ConsultationRecommendationJobState = {
  consultationId: string;
  recommendationId: string;
  taskId: string;
  jobId: string;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  attempts: number;
  maxAttempts: number;
  errorCode: string | null;
};

/** Read durable queue state for a consultation's recommendations. */
export function listConsultationRecommendationJobs(
  consultationId: string,
): ConsultationRecommendationJobState[] {
  const rows = db()
    .prepare(
      "SELECT j.id,j.task_id,j.status,j.attempts,j.error_code,p.max_attempts,p.payload_json FROM generation_jobs j JOIN generation_job_payloads p ON p.job_id=j.id WHERE j.status IN ('queued','processing','completed','failed','cancelled') ORDER BY j.queued_at ASC",
    )
    .all() as Row[];
  const states: ConsultationRecommendationJobState[] = [];
  for (const row of rows) {
    let metadata: QueueMetadata | undefined;
    try {
      metadata = (JSON.parse(String(row.payload_json)) as QueuePayload)
        .queueMetadata;
    } catch {
      metadata = undefined;
    }
    if (metadata?.consultationId !== consultationId || !metadata.recommendationId)
      continue;
    states.push({
      consultationId,
      recommendationId: metadata.recommendationId,
      taskId: String(row.task_id),
      jobId: String(row.id),
      status: String(row.status) as ConsultationRecommendationJobState["status"],
      attempts: Number(row.attempts),
      maxAttempts: Number(row.max_attempts),
      errorCode: row.error_code ? String(row.error_code) : null,
    });
  }
  return states;
}

export function requestConsultationRecommendationCancellation(
  consultationId: string,
  recommendationId: string,
) {
  const state = listConsultationRecommendationJobs(consultationId).find(
    (item) => item.recommendationId === recommendationId,
  );
  if (!state)
    return { ok: false as const, reason: "NOT_FOUND" as const };
  return {
    ...requestGenerationCancellation(state.taskId),
    consultationId,
    recommendationId,
    taskId: state.taskId,
  };
}

export function retryConsultationRecommendation(
  consultationId: string,
  recommendationId: string,
  user: AuthUser | null,
) {
  const state = listConsultationRecommendationJobs(consultationId).find(
    (item) => item.recommendationId === recommendationId,
  );
  if (!state)
    return { ok: false as const, reason: "NOT_FOUND" as const };
  return {
    ...retryFailedGeneration(state.taskId, user),
    consultationId,
    recommendationId,
    taskId: state.taskId,
  };
}

export function claimNextGenerationJob(now = Date.now()): ClaimedJob | null {
  const database = db();
  const row = database
    .prepare(
      `SELECT j.*,p.owner_session_id,p.payload_json,p.source_image_path,p.max_attempts FROM generation_jobs j JOIN generation_job_payloads p ON p.job_id=j.id
    WHERE j.status='queued' AND p.cancel_requested=0 AND p.available_at<=? ORDER BY j.queued_at LIMIT 1`,
    )
    .get(now) as Row | undefined;
  if (!row) return null;
  const lockToken = crypto.randomUUID();
  database.exec("BEGIN IMMEDIATE");
  try {
    const changed = database
      .prepare(
        "UPDATE generation_jobs SET status='processing',attempts=attempts+1,started_at=COALESCE(started_at,?) WHERE id=? AND status='queued'",
      )
      .run(new Date(now).toISOString(), String(row.id)).changes;
    if (!changed) {
      database.exec("ROLLBACK");
      return null;
    }
    database
      .prepare(
        "UPDATE generation_job_payloads SET lock_token=?,locked_at=?,heartbeat_at=? WHERE job_id=?",
      )
      .run(lockToken, now, now, String(row.id));
    database.exec("COMMIT");
    return {
      id: String(row.id),
      taskId: String(row.task_id),
      userId: row.user_id ? String(row.user_id) : null,
      modelConfigId: String(row.model_config_id),
      attempts: Number(row.attempts) + 1,
      maxAttempts: Number(row.max_attempts),
      ownerSessionId: String(row.owner_session_id),
      payload: JSON.parse(String(row.payload_json)) as QueuePayload,
      sourceImagePath: row.source_image_path
        ? String(row.source_image_path)
        : null,
      lockToken,
    };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function isCancelRequested(jobId: string) {
  const row = db()
    .prepare(
      "SELECT cancel_requested FROM generation_job_payloads WHERE job_id=?",
    )
    .get(jobId) as { cancel_requested: number } | undefined;
  return Boolean(row?.cancel_requested);
}
function retryable(code: string) {
  return ![
    "SOURCE_IMAGE_REQUIRED",
    "INVALID_SOURCE_IMAGE",
    "RUNNINGHUB_API_KEY_MISSING",
    "PROVIDER_NOT_IMPLEMENTED",
    "MODEL_DISABLED",
    "MODEL_NOT_FOUND",
  ].some((item) => code.startsWith(item));
}

function finalizeSuccess(
  job: ClaimedJob,
  generated: Awaited<ReturnType<typeof generateHairstyleImages>>,
) {
  const database = db();
  const now = new Date().toISOString();
  const variants = job.payload.variants.map((variant) => ({
    ...variant,
    resultImageUrl: generated.imageUrls[variant.template.id],
  }));
  database.exec("BEGIN IMMEDIATE");
  try {
    const changed = database
      .prepare(
        "UPDATE generation_jobs SET status='completed',actual_cost_micros=actual_cost_micros+?,completed_at=? WHERE id=? AND status='processing'",
      )
      .run(generated.actualCostMicros, now, job.id).changes;
    if (!changed) throw new Error("JOB_STATE_CONFLICT");
    database
      .prepare(
        "UPDATE design_tasks SET status='completed',variants_json=?,generation_mode=? WHERE id=?",
      )
      .run(JSON.stringify(variants), generated.mode, job.taskId);
    database
      .prepare(
        "UPDATE generation_job_payloads SET lock_token=NULL,locked_at=NULL,heartbeat_at=NULL,last_error=NULL WHERE job_id=?",
      )
      .run(job.id);
    database
      .prepare(
        "INSERT INTO usage_records(id,user_id,task_id,generation_mode,variant_count,created_at) VALUES(?,?,?,?,?,?)",
      )
      .run(
        crypto.randomUUID(),
        job.userId,
        job.taskId,
        generated.mode,
        variants.length,
        now,
      );
    finalizeGenerationAccess(job.id, true);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  try {
    removeSourceImage(job.sourceImagePath);
    database
      .prepare(
        "UPDATE generation_job_payloads SET source_image_path=NULL,source_expires_at=NULL WHERE job_id=?",
      )
      .run(job.id);
  } catch (error) {
    recordOperationalEvent(
      "warning",
      "source.cleanup_failed",
      "生成成功后临时原图清理失败",
      job.id,
      { message: error instanceof Error ? error.message : "UNKNOWN" },
    );
  }
  recordOperationalEvent("info", "job.completed", "生成任务完成", job.id, {
    taskId: job.taskId,
    attempts: job.attempts,
    costMicros: generated.actualCostMicros,
  });
  return variants;
}

function finalizeFailure(job: ClaimedJob, code: string, costMicros: number) {
  const database = db();
  const now = new Date().toISOString();
  database.exec("BEGIN IMMEDIATE");
  let changed = false;
  try {
    changed =
      database
        .prepare(
          "UPDATE generation_jobs SET status='failed',error_code=?,actual_cost_micros=actual_cost_micros+?,completed_at=? WHERE id=? AND status IN ('queued','processing')",
        )
        .run(code, Math.max(0, costMicros), now, job.id).changes > 0;
    if (changed) finalizeGenerationAccess(job.id, false);
    database
      .prepare("UPDATE design_tasks SET status='failed' WHERE id=?")
      .run(job.taskId);
    database
      .prepare(
        "UPDATE generation_job_payloads SET lock_token=NULL,locked_at=NULL,heartbeat_at=NULL,last_error=? WHERE job_id=?",
      )
      .run(code, job.id);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  recordOperationalEvent(
    "critical",
    "job.failed",
    "生成任务达到失败终态",
    job.id,
    { taskId: job.taskId, code, attempts: job.attempts, costMicros },
  );
  return changed;
}

function requeue(
  job: ClaimedJob,
  code: string,
  costMicros: number,
  now = Date.now(),
) {
  const delay = Math.min(60_000, 2 ** Math.max(0, job.attempts - 1) * 1000);
  const database = db();
  database.exec("BEGIN IMMEDIATE");
  try {
    database
      .prepare(
        "UPDATE generation_jobs SET status='queued',error_code=?,actual_cost_micros=actual_cost_micros+? WHERE id=? AND status='processing'",
      )
      .run(code, Math.max(0, costMicros), job.id);
    database
      .prepare(
        "UPDATE generation_job_payloads SET available_at=?,lock_token=NULL,locked_at=NULL,heartbeat_at=NULL,last_error=? WHERE job_id=?",
      )
      .run(now + delay, code, job.id);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  recordOperationalEvent(
    "warning",
    "job.retry_scheduled",
    "生成任务等待自动重试",
    job.id,
    {
      taskId: job.taskId,
      attempt: job.attempts,
      nextAttemptAt: new Date(now + delay).toISOString(),
      code,
    },
  );
  return delay;
}

function finalizeCancellation(job: ClaimedJob, costMicros = 0) {
  const database = db();
  const now = new Date().toISOString();
  database.exec("BEGIN IMMEDIATE");
  let changed = false;
  try {
    changed =
      database
        .prepare(
          "UPDATE generation_jobs SET status='cancelled',actual_cost_micros=actual_cost_micros+?,completed_at=? WHERE id=? AND status IN ('queued','processing')",
        )
        .run(Math.max(0, costMicros), now, job.id).changes > 0;
    if (changed) finalizeGenerationAccess(job.id, false);
    database
      .prepare("UPDATE design_tasks SET status='failed' WHERE id=?")
      .run(job.taskId);
    database
      .prepare(
        "UPDATE generation_job_payloads SET lock_token=NULL,locked_at=NULL,heartbeat_at=NULL,last_error='CANCELLED' WHERE job_id=?",
      )
      .run(job.id);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  removeAssetsForTask(job.taskId);
  try {
    removeSourceImage(job.sourceImagePath);
    database
      .prepare(
        "UPDATE generation_job_payloads SET source_image_path=NULL,source_expires_at=NULL WHERE job_id=?",
      )
      .run(job.id);
  } catch (error) {
    recordOperationalEvent(
      "warning",
      "source.cleanup_failed",
      "取消任务后临时原图清理失败",
      job.id,
      { message: error instanceof Error ? error.message : "UNKNOWN" },
    );
  }
  recordOperationalEvent("info", "job.cancelled", "生成任务已取消", job.id, {
    taskId: job.taskId,
    costMicros,
  });
  return changed;
}

export async function processNextGenerationJob(now = Date.now()) {
  const job = claimNextGenerationJob(now);
  if (!job) return { status: "idle" as const };
  if (isCancelRequested(job.id)) {
    finalizeCancellation(job);
    return { status: "cancelled" as const, jobId: job.id };
  }
  try {
    const runtime = getModelRuntimeById(job.modelConfigId);
    if (!runtime) throw new Error("MODEL_NOT_FOUND");
    if (!runtime.enabled) throw new Error("MODEL_DISABLED");
    const imageDataUrl = readSourceImage(job.sourceImagePath);
    const generated = await generateHairstyleImages(
      job.payload.variants.map((item) => item.template),
      {
        taskId: job.taskId,
        ownerSessionId: job.ownerSessionId,
        userId: job.userId,
        preferences: job.payload.preferences,
        imageDataUrl,
        consultationId: job.payload.queueMetadata?.consultationId,
        recommendationId: job.payload.queueMetadata?.recommendationId,
      },
      runtime,
    );
    if (isCancelRequested(job.id)) {
      finalizeCancellation(job, generated.actualCostMicros);
      return { status: "cancelled" as const, jobId: job.id };
    }
    finalizeSuccess(job, generated);
    return { status: "completed" as const, jobId: job.id, taskId: job.taskId };
  } catch (error) {
    const code = error instanceof Error ? error.message : "GENERATION_FAILED";
    const cost =
      typeof error === "object" && error && "actualCostMicros" in error
        ? Number(error.actualCostMicros)
        : 0;
    removeAssetsForTask(job.taskId);
    if (job.attempts < job.maxAttempts && retryable(code)) {
      const delayMs = requeue(job, code, Number.isFinite(cost) ? cost : 0, now);
      return { status: "retrying" as const, jobId: job.id, delayMs, code };
    }
    finalizeFailure(job, code.slice(0, 100), Number.isFinite(cost) ? cost : 0);
    return { status: "failed" as const, jobId: job.id, code };
  }
}

export function requestGenerationCancellation(taskId: string) {
  const row = db()
    .prepare(
      "SELECT j.*,p.source_image_path,p.owner_session_id,p.payload_json,p.max_attempts FROM generation_jobs j JOIN generation_job_payloads p ON p.job_id=j.id WHERE j.task_id=?",
    )
    .get(taskId) as Row | undefined;
  if (!row) return { ok: false as const, reason: "NOT_FOUND" };
  if (row.status === "queued") {
    const job: ClaimedJob = {
      id: String(row.id),
      taskId,
      userId: row.user_id ? String(row.user_id) : null,
      modelConfigId: String(row.model_config_id),
      attempts: Number(row.attempts),
      maxAttempts: Number(row.max_attempts),
      ownerSessionId: String(row.owner_session_id),
      payload: JSON.parse(String(row.payload_json)),
      sourceImagePath: row.source_image_path
        ? String(row.source_image_path)
        : null,
      lockToken: "",
    };
    finalizeCancellation(job);
    return { ok: true as const, status: "cancelled" as const };
  }
  if (row.status === "processing") {
    db()
      .prepare(
        "UPDATE generation_job_payloads SET cancel_requested=1 WHERE job_id=?",
      )
      .run(String(row.id));
    recordOperationalEvent(
      "info",
      "job.cancel_requested",
      "用户请求取消生成任务",
      String(row.id),
      { taskId },
    );
    return { ok: true as const, status: "cancelling" as const };
  }
  return { ok: false as const, reason: "TERMINAL" };
}

export function retryFailedGeneration(taskId: string, user: AuthUser | null) {
  const row = db()
    .prepare(
      "SELECT j.*,p.source_image_path FROM generation_jobs j JOIN generation_job_payloads p ON p.job_id=j.id WHERE j.task_id=? AND j.status='failed'",
    )
    .get(taskId) as Row | undefined;
  if (!row) return { ok: false as const, reason: "NOT_RETRYABLE" };
  const source = row.source_image_path ? String(row.source_image_path) : null;
  if (
    getModelRuntimeById(String(row.model_config_id))?.provider ===
      "runninghub" &&
    (!source || !existsSync(source))
  )
    return { ok: false as const, reason: "SOURCE_EXPIRED" };
  const database = db();
  const now = new Date().toISOString();
  database.exec("BEGIN IMMEDIATE");
  try {
    assertGlobalCostFuse(Number(row.estimated_cost_micros));
    reserveGenerationAccess({
      jobId: String(row.id),
      user,
      sessionId: String(
        (
          database
            .prepare(
              "SELECT owner_session_id FROM generation_job_payloads WHERE job_id=?",
            )
            .get(String(row.id)) as { owner_session_id: string }
        ).owner_session_id,
      ),
      variantCount: Number(row.variant_count),
      now,
    });
    database
      .prepare(
        "UPDATE generation_jobs SET status='queued',error_code=NULL,attempts=0,started_at=NULL,completed_at=NULL WHERE id=?",
      )
      .run(String(row.id));
    database
      .prepare(
        "UPDATE generation_job_payloads SET available_at=?,cancel_requested=0,lock_token=NULL,locked_at=NULL,heartbeat_at=NULL,last_error=NULL WHERE job_id=?",
      )
      .run(Date.now(), String(row.id));
    database
      .prepare("UPDATE design_tasks SET status='processing' WHERE id=?")
      .run(taskId);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  recordOperationalEvent(
    "info",
    "job.manual_retry",
    "生成任务由用户重新入队",
    String(row.id),
    { taskId },
  );
  return { ok: true as const };
}

export function recoverStaleGenerationJobs(now = Date.now()) {
  const staleMs = positiveInteger(process.env.JOB_STALE_MS, 15 * 60 * 1000);
  const rows = db()
    .prepare(
      "SELECT j.*,p.owner_session_id,p.payload_json,p.source_image_path,p.max_attempts,p.cancel_requested FROM generation_jobs j JOIN generation_job_payloads p ON p.job_id=j.id WHERE j.status='processing' AND COALESCE(p.heartbeat_at,p.locked_at,0)<?",
    )
    .all(now - staleMs) as Row[];
  let requeued = 0;
  let failed = 0;
  let cancelled = 0;
  for (const row of rows) {
    const job: ClaimedJob = {
      id: String(row.id),
      taskId: String(row.task_id),
      userId: row.user_id ? String(row.user_id) : null,
      modelConfigId: String(row.model_config_id),
      attempts: Number(row.attempts),
      maxAttempts: Number(row.max_attempts),
      ownerSessionId: String(row.owner_session_id),
      payload: JSON.parse(String(row.payload_json)),
      sourceImagePath: row.source_image_path
        ? String(row.source_image_path)
        : null,
      lockToken: "",
    };
    if (Boolean(row.cancel_requested)) {
      finalizeCancellation(job);
      cancelled += 1;
    } else if (job.attempts < job.maxAttempts) {
      requeue(job, "WORKER_STALE", 0, now);
      requeued += 1;
    } else {
      finalizeFailure(job, "WORKER_STALE", 0);
      failed += 1;
    }
  }
  return { found: rows.length, requeued, failed, cancelled };
}

export function queueStats() {
  const row = db()
    .prepare(
      "SELECT SUM(status='queued') AS queued,SUM(status='processing') AS processing,SUM(status='failed') AS failed,SUM(status='cancelled') AS cancelled FROM generation_jobs",
    )
    .get() as Row;
  return {
    queued: Number(row.queued ?? 0),
    processing: Number(row.processing ?? 0),
    failed: Number(row.failed ?? 0),
    cancelled: Number(row.cancelled ?? 0),
  };
}
