import { createHash, randomUUID } from "node:crypto";
import { db, type AuthUser } from "@/lib/database";
import {
  assertConsultationAccess,
  assertRecommendationBelongsToConsultation,
  assertStatusTransition,
  type ConsultationActor,
  ConsultationDomainError,
} from "@/lib/consultation-domain";
import { runConsultation, type ConsultationInput } from "@/lib/ai-consultation";
import {
  configuredConsultationTimeoutMs,
  createConfiguredConsultationProvider,
} from "@/lib/consultation-provider";
import { getActiveModelConfig } from "@/lib/model-operations";
import {
  HAIRSTYLES,
  isTemplateCompatibleWithTreatmentMode,
  recommendTemplates,
} from "@/lib/catalog";
import { readSourceImage } from "@/lib/source-storage";
import { enqueueConsultationRecommendations } from "@/lib/generation-queue";
import {
  DEFAULT_DESIGN_PREFERENCES,
  hasValidHairColorPreference,
  normalizeConsultationBrief,
  normalizeDesignPreferences,
  type Consultation,
  type ConsultationBrief,
  type ConsultationStatus,
  type HairGoal,
  type HairLength,
  type Recommendation,
  type StoredDesignTask,
} from "@/lib/types";

type Row = Record<string, unknown>;
export function actorForUser(user: AuthUser): ConsultationActor {
  return { userId: user.id, tenantId: user.storeId, role: user.role === "store_owner" ? "salon_admin" : user.role === "staff" ? "stylist" : "consumer" };
}
const json = <T>(value: unknown, fallback: T): T => { try { return typeof value === "string" ? JSON.parse(value) as T : (value as T) ?? fallback; } catch { return fallback; } };
const mapRecommendation = (r: Row): Recommendation => ({ id: String(r.id), consultationId: String(r.consultation_id), styleName: String(r.style_name), rationale: String(r.rationale), execution: json(r.execution_json, {}), imageUrl: r.image_url ? String(r.image_url) : undefined, rank: Number(r.rank ?? 0), createdAt: String(r.created_at) });
const mapConsultation = (r: Row): Consultation => {
  const analysis = json<Record<string, unknown> | null>(r.analysis_json, null);
  const brief = analysis?.consultationBrief;
  const analysisResult = brief && typeof brief === "object"
    ? { ...analysis, consultationBrief: normalizeConsultationBrief(brief as Partial<ConsultationBrief> & { chemical?: boolean }) }
    : analysis;
  return { id: String(r.id), salonId: r.salon_id ? String(r.salon_id) : null, customerUserId: r.customer_user_id ? String(r.customer_user_id) : null, stylistUserId: r.stylist_user_id ? String(r.stylist_user_id) : null, status: String(r.status) as ConsultationStatus, sourcePhotoPath: r.source_photo_path ? String(r.source_photo_path) : null, analysisResult, recommendations: [], selectedRecommendationId: r.selected_recommendation_id ? String(r.selected_recommendation_id) : null, generationStatus: String(r.generation_status ?? "idle") as Consultation["generationStatus"], sourceConsentAt: r.source_consent_at ? String(r.source_consent_at) : null, sourceConsentVersion: r.source_consent_version ? String(r.source_consent_version) : null, sourceQuality: json(r.source_quality_json, null), createdAt: String(r.created_at), updatedAt: String(r.updated_at) };
};
export function findConsultation(id: string): Consultation | null {
  const row = db().prepare("SELECT * FROM consultations WHERE id=?").get(id) as Row | undefined;
  if (!row) return null;
  const item = mapConsultation(row);
  item.recommendations = (db().prepare("SELECT * FROM recommendations WHERE consultation_id=? ORDER BY rank").all(id) as Row[]).map(mapRecommendation);
  return item;
}
export function requireConsultation(id: string, actor: ConsultationActor) { const item = findConsultation(id); if (!item) throw new ConsultationDomainError("CONSULTATION_NOT_FOUND"); assertConsultationAccess(actor, item); return item; }
export function consultationInputWithSourceImage(
  item: Pick<Consultation, "sourcePhotoPath">,
  input: ConsultationInput = {},
): ConsultationInput {
  if (!item.sourcePhotoPath) return input;
  return { ...input, imageDataUrl: readSourceImage(item.sourcePhotoPath) };
}
export function ensureSalon(salonId: string, user: AuthUser) {
  const exists = db().prepare("SELECT id FROM salons WHERE id=?").get(salonId);
  if (!exists) db().prepare("INSERT INTO salons(id,name,stylist_name,email,owner_user_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").run(salonId, user.storeName ?? "Salon", user.name, user.email, user.id, new Date().toISOString(), new Date().toISOString());
}
export function consultationIdForKey(scope: string, idempotencyKey: string): string {
  return createHash("sha256").update(`${scope}:${idempotencyKey}`).digest("hex").slice(0, 32);
}
export function createDraft(input: { id?: string; salonId: string | null; stylistUserId: string | null; customerUserId?: string | null; sourcePhotoPath?: string | null; sourceConsentAt?: string | null; sourceConsentVersion?: string | null; sourceQuality?: unknown; idempotencyKey?: string }) {
  const id = input.id ?? (input.idempotencyKey ? consultationIdForKey(input.salonId ?? `consumer:${input.customerUserId ?? "unknown"}`, input.idempotencyKey) : randomUUID());
  const existing = findConsultation(id); if (existing) return { item: existing, created: false };
  const now = new Date().toISOString();
  db().prepare("INSERT INTO consultations(id,salon_id,customer_user_id,stylist_user_id,status,source_photo_path,source_consent_at,source_consent_version,source_quality_json,generation_status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").run(id,input.salonId,input.customerUserId ?? null,input.stylistUserId,"draft",input.sourcePhotoPath ?? null,input.sourceConsentAt ?? null,input.sourceConsentVersion ?? null,input.sourceQuality ? JSON.stringify(input.sourceQuality) : null,"idle",now,now);
  return { item: findConsultation(id)!, created: true };
}
export function listForActor(actor: ConsultationActor) {
  const rows = actor.role === "consumer" ? db().prepare("SELECT * FROM consultations WHERE customer_user_id=? ORDER BY created_at DESC").all(actor.userId) : db().prepare("SELECT * FROM consultations WHERE salon_id=? ORDER BY created_at DESC").all(actor.tenantId);
  return (rows as Row[]).map(mapConsultation).map((x) => { x.recommendations=(db().prepare("SELECT * FROM recommendations WHERE consultation_id=? ORDER BY rank").all(x.id) as Row[]).map(mapRecommendation); return x; });
}
export async function analyze(item: Consultation, input: ConsultationInput = {}) {
  assertStatusTransition(item.status, "analyzing");
  db().prepare("UPDATE consultations SET status='analyzing',updated_at=? WHERE id=?").run(new Date().toISOString(), item.id);
  try {
    let provider = null;
    try {
      provider = createConfiguredConsultationProvider();
    } catch {
      // Invalid optional configuration must never block consultation recovery.
    }
    const fallbackProvider = { analyze: async () => { throw new Error("CONSULTATION_PROVIDER_NOT_CONFIGURED"); } };
    if (provider && !item.sourcePhotoPath) throw new Error("SOURCE_IMAGE_REQUIRED");
    const { brief, ...modelInput } = input;
    const providerInput = provider
      ? consultationInputWithSourceImage(item, modelInput)
      : modelInput;
    const result = await runConsultation(provider ?? fallbackProvider, providerInput, {
      timeoutMs: configuredConsultationTimeoutMs(),
    });
    const report = result.report;
    const analysis = {
      ...report.analysis,
      consultationBrief: brief ?? null,
      status: report.status,
      source: result.source,
      explanation: report.explanation ?? null,
      reason: result.reason ?? null,
    };
    const now = new Date().toISOString(); const d = db();
    d.prepare("DELETE FROM recommendations WHERE consultation_id=?").run(item.id);
    report.recommendations.forEach((r, i) => d.prepare("INSERT INTO recommendations(id,consultation_id,style_name,rationale,execution_json,rank,created_at) VALUES(?,?,?,?,?,?,?)").run(randomUUID(), item.id, r.styleName, r.fitReason, JSON.stringify({ suitableFor:r.suitableFor, maintenanceMinutes:String(r.maintenanceMinutes), maintenanceLevel:r.maintenanceLevel, advice:r.executionAdvice.join(" ") }), i+1, now));
    d.prepare("UPDATE consultations SET status='ready',analysis_json=?,generated_images_json=?,generation_status='idle',updated_at=? WHERE id=?").run(JSON.stringify(analysis), JSON.stringify([]), now, item.id);
  } catch (error) { db().prepare("UPDATE consultations SET status='draft',updated_at=? WHERE id=?").run(new Date().toISOString(), item.id); throw error; }
  return findConsultation(item.id)!;
}
export function selectRecommendation(item: Consultation, id: string) {
  assertRecommendationBelongsToConsultation(item.recommendations.find((r) => r.id === id), item.id); assertStatusTransition(item.status, "completed");
  db().prepare("UPDATE consultations SET selected_recommendation_id=?,status='completed',updated_at=? WHERE id=?").run(id,new Date().toISOString(),item.id); return findConsultation(item.id)!;
}
export function archive(item: Consultation) { assertStatusTransition(item.status,"archived"); db().prepare("UPDATE consultations SET status='archived',updated_at=? WHERE id=?").run(new Date().toISOString(),item.id); return findConsultation(item.id)!; }

function consultationBriefFromAnalysis(item: Consultation): ConsultationBrief | undefined {
  const value = item.analysisResult?.consultationBrief;
  if (!value || typeof value !== "object") return undefined;
  const brief = value as Record<string, unknown>;
  const lengths: HairLength[] = ["short", "medium", "long"];
  const goals: HairGoal[] = ["fresh", "younger", "volume", "professional", "fashion"];
  if (!lengths.includes(brief.currentLength as HairLength) || !lengths.includes(brief.targetLength as HairLength) || !goals.includes(brief.goal as HairGoal)) return undefined;
  const normalized = normalizeConsultationBrief(brief as Partial<ConsultationBrief> & { chemical?: boolean });
  return hasValidHairColorPreference(normalized) ? normalized : undefined;
}

const cutOnlyFallback = (index: number, brief: ConsultationBrief) => {
  const candidates = recommendTemplates({
    audience: "neutral",
    targetLength: brief.targetLength,
    goal: brief.goal,
    treatmentMode: brief.treatmentMode,
  });
  return candidates[index % candidates.length] ?? HAIRSTYLES.find((template) => !template.requiresPermOrHeat)!;
};

const recommendationTemplate = (recommendation: Recommendation, index: number, brief?: ConsultationBrief) => {
  const name = recommendation.styleName.toLocaleLowerCase();
  const exact = HAIRSTYLES.find((template) => template.name.toLocaleLowerCase() === name);
  let selected = exact;
  if (!selected && (name.includes("crop") || name.includes("碎"))) selected = HAIRSTYLES.find((template) => template.id === "textured-crop");
  if (!selected && (name.includes("side") || name.includes("part") || name.includes("侧分"))) selected = HAIRSTYLES.find((template) => template.id === "clean-side");
  if (!selected && (name.includes("bob") || name.includes("波波"))) selected = HAIRSTYLES.find((template) => template.id === "french-bob");
  if (!selected && (name.includes("wave") || name.includes("curl") || name.includes("卷"))) selected = HAIRSTYLES.find((template) => template.id === "soft-waves");
  if (!selected && (name.includes("long") || name.includes("长发"))) selected = HAIRSTYLES.find((template) => template.id === "long-layer");
  selected ??= [
    HAIRSTYLES.find((template) => template.id === "textured-crop")!,
    HAIRSTYLES.find((template) => template.id === "clean-side")!,
    HAIRSTYLES.find((template) => template.id === "french-bob")!,
  ][index % 3];
  return !brief || isTemplateCompatibleWithTreatmentMode(selected, brief.treatmentMode)
    ? selected
    : cutOnlyFallback(index, brief);
};

export function enqueueConsultationGeneration(item: Consultation, user: AuthUser) {
  const active = getActiveModelConfig();
  if (!active) throw new Error("NO_ACTIVE_MODEL");
  if (item.status === "archived" || item.recommendations.length === 0)
    throw new ConsultationDomainError("INVALID_CONSULTATION_INPUT");
  const sourceExpiresAt = Date.parse(item.createdAt) + 30 * 24 * 60 * 60 * 1000;
  const generationMode = active.provider === "runninghub"
    ? "api"
    : active.provider === "local"
      ? "demo-fixed"
      : "mock";
  const brief = consultationBriefFromAnalysis(item);
  return enqueueConsultationRecommendations({
    consultationId: item.id,
    user,
    ownerKey: `user:${user.id}`,
    recommendations: item.recommendations.map((recommendation, index) => {
      const template = recommendationTemplate(recommendation, index, brief);
      const task: StoredDesignTask = {
        id: randomUUID(),
        ownerSessionId: `consultation:${item.id}`,
        userId: user.id,
        status: "queued",
        createdAt: new Date().toISOString(),
        generationMode,
        preferences: normalizeDesignPreferences({ ...DEFAULT_DESIGN_PREFERENCES, ...(brief ?? {}) }),
        variants: [{
          id: randomUUID(),
          template,
          reason: recommendation.rationale,
        }],
      };
      return {
        recommendationId: recommendation.id,
        task,
        sourceImagePath: item.sourcePhotoPath,
        sourceExpiresAt: Number.isFinite(sourceExpiresAt) ? sourceExpiresAt : Date.now() + 30 * 24 * 60 * 60 * 1000,
      };
    }),
  });
}
