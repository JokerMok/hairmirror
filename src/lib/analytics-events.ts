import { createHash } from "node:crypto";
import { z } from "zod";
import type { AuthUser } from "./database";
import { db } from "./database";

/**
 * Product analytics is intentionally a closed contract.  Do not add email,
 * phone, image data, prompts, or free-form customer text to these payloads.
 */
export const analyticsEventNames = [
  "role_selected",
  "photo_uploaded",
  "analysis_completed",
  "recommendations_viewed",
  "generation_succeeded",
  "generation_failed",
  "communication_card_copied",
  "consultation_saved",
] as const;

export type AnalyticsEventName = (typeof analyticsEventNames)[number];
export type AnalyticsRole = "consumer" | "stylist";
export type AnalyticsSurface = "consumer" | "salon";

const role = z.enum(["consumer", "stylist"]);
const surface = z.enum(["consumer", "salon"]);
const durationBucket = z.enum(["lt_5s", "5_15s", "15_30s", "gt_30s"]);

export const analyticsEventSchema = z.discriminatedUnion("event", [
  z
    .object({
      event: z.literal("role_selected"),
      role,
      entryPoint: z.enum(["landing", "auth", "salon_invite"]),
    })
    .strict(),
  z
    .object({
      event: z.literal("photo_uploaded"),
      role,
      surface,
      photoCount: z.number().int().min(1).max(2),
      source: z.enum(["camera", "library", "dropzone"]),
      fileType: z.enum(["jpg", "png", "webp"]),
      fileSizeBucket: z.enum(["lt_1mb", "1_4mb", "4_8mb"]),
    })
    .strict(),
  z
    .object({
      event: z.literal("analysis_completed"),
      role,
      surface,
      confidenceBand: z.enum(["low", "medium", "high"]),
      recommendationCount: z.number().int().min(0).max(6),
      duration: durationBucket,
    })
    .strict(),
  z
    .object({
      event: z.literal("recommendations_viewed"),
      role,
      surface,
      recommendationCount: z.number().int().min(0).max(6),
      viewMode: z.enum(["list", "comparison", "report"]),
    })
    .strict(),
  z
    .object({
      event: z.literal("generation_succeeded"),
      role,
      surface,
      variantCount: z.number().int().min(1).max(6),
      duration: durationBucket,
    })
    .strict(),
  z
    .object({
      event: z.literal("generation_failed"),
      role,
      surface,
      errorCode: z.enum([
        "provider_unavailable",
        "timeout",
        "invalid_image",
        "quota_exceeded",
        "cancelled",
        "unknown",
      ]),
      retryable: z.boolean(),
    })
    .strict(),
  z
    .object({
      event: z.literal("communication_card_copied"),
      role,
      surface,
      format: z.enum(["text", "markdown", "image"]),
      hasSelectedStyle: z.boolean(),
    })
    .strict(),
  z
    .object({
      event: z.literal("consultation_saved"),
      role: z.literal("stylist"),
      surface: z.literal("salon"),
      recommendationCount: z.number().int().min(0).max(6),
      hasSelectedStyle: z.boolean(),
    })
    .strict(),
]);

export type AnalyticsEvent = z.infer<typeof analyticsEventSchema>;

export type AnalyticsContext = {
  user: AuthUser | null;
  anonymousToken?: string;
};

export type SalonWeeklyMetrics = {
  weekStart: string;
  weekEnd: string;
  activatedSalons: number;
  activeSalons: number;
  activeStylists: number;
  consultationsSaved: number;
  generationAttempts: number;
  generationSuccesses: number;
  generationSuccessRate: number;
  eventCount: number;
};

const ANALYTICS_SCHEMA_VERSION = 1;

function hashIdentifier(value: string) {
  const salt = process.env.ANALYTICS_HASH_SALT ?? "hairmirror-analytics-v1";
  return createHash("sha256")
    .update(`${salt}:${value}`)
    .digest("hex")
    .slice(0, 32);
}

function isoWeekStart(input: Date) {
  const date = new Date(input);
  date.setUTCHours(0, 0, 0, 0);
  const day = date.getUTCDay();
  const distanceToMonday = day === 0 ? 6 : day - 1;
  date.setUTCDate(date.getUTCDate() - distanceToMonday);
  return date;
}

function toDetails(event: AnalyticsEvent, context: AnalyticsContext) {
  const user = context.user;
  const actorSource = user?.id ?? context.anonymousToken;
  const isSalon = event.role === "stylist";
  return {
    schema_version: ANALYTICS_SCHEMA_VERSION,
    actor_role: event.role,
    tenant_type: isSalon ? "salon" : "consumer",
    actor_hash: actorSource ? hashIdentifier(actorSource) : null,
    tenant_hash: isSalon
      ? hashIdentifier(user?.storeId ?? user?.id ?? context.anonymousToken ?? "anonymous")
      : null,
    authenticated: Boolean(user),
    ...event,
  };
}

/** Persist an event in the existing operational event stream. */
export function recordAnalyticsEvent(
  event: AnalyticsEvent,
  context: AnalyticsContext,
  occurredAt = new Date(),
) {
  const createdAt = occurredAt.toISOString();
  const details = toDetails(event, context);
  const result = db()
    .prepare(
      "INSERT INTO operational_events(id,level,event_type,resource_id,message,details_json,created_at) VALUES(?,?,?,?,?,?,?)",
    )
    .run(
      crypto.randomUUID(),
      "info",
      `analytics.${event.event}`,
      details.tenant_hash,
      `analytics.${event.event}`,
      JSON.stringify(details),
      createdAt,
    );
  return Number(result.changes ?? 0) === 1;
}

/** Aggregate only pseudonymous Salon events for a calendar week (UTC). */
export function getSalonWeeklyMetrics(
  weekStartInput = isoWeekStart(new Date()),
): SalonWeeklyMetrics {
  const weekStart = isoWeekStart(weekStartInput);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
  const start = weekStart.toISOString();
  const end = weekEnd.toISOString();
  const rows = db()
    .prepare(
      "SELECT event_type, details_json FROM operational_events WHERE event_type LIKE 'analytics.%' AND created_at>=? AND created_at<?",
    )
    .all(start, end) as Array<{ event_type: string; details_json: string }>;
  const activated = new Set<string>();
  const active = new Set<string>();
  const stylists = new Set<string>();
  let saved = 0;
  let generationAttempts = 0;
  let generationSuccesses = 0;
  let eventCount = 0;
  for (const row of rows) {
    let details: Record<string, unknown>;
    try {
      details = JSON.parse(row.details_json) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (details.tenant_type !== "salon" || typeof details.tenant_hash !== "string")
      continue;
    eventCount += 1;
    const tenantHash = details.tenant_hash;
    const actorHash = typeof details.actor_hash === "string" ? details.actor_hash : null;
    active.add(tenantHash);
    if (actorHash) stylists.add(actorHash);
    if (row.event_type === "analytics.role_selected" || row.event_type === "analytics.consultation_saved")
      activated.add(tenantHash);
    if (row.event_type === "analytics.consultation_saved") saved += 1;
    if (
      row.event_type === "analytics.generation_succeeded" ||
      row.event_type === "analytics.generation_failed"
    ) {
      generationAttempts += 1;
      if (row.event_type === "analytics.generation_succeeded") generationSuccesses += 1;
    }
  }
  return {
    weekStart: start,
    weekEnd: end,
    activatedSalons: activated.size,
    activeSalons: active.size,
    activeStylists: stylists.size,
    consultationsSaved: saved,
    generationAttempts,
    generationSuccesses,
    generationSuccessRate: generationAttempts ? generationSuccesses / generationAttempts : 0,
    eventCount,
  };
}

