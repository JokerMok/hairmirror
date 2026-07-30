import { createHash, randomUUID } from "node:crypto";
import { db } from "@/lib/database";
import {
  assertConsultationAccess,
  assertRecommendationBelongsToConsultation,
  assertStatusTransition,
  type ConsultationActor,
  ConsultationDomainError,
} from "@/lib/consultation-domain";
import { createFallbackConsultation } from "@/lib/ai-consultation-fallback";
import type { AuthUser } from "@/lib/database";
import type { Consultation, ConsultationStatus, Recommendation } from "@/lib/types";

type Row = Record<string, unknown>;
export function actorForUser(user: AuthUser): ConsultationActor {
  return { userId: user.id, tenantId: user.storeId, role: user.role === "store_owner" ? "salon_admin" : user.role === "staff" ? "stylist" : "consumer" };
}
const json = <T>(value: unknown, fallback: T): T => { try { return typeof value === "string" ? JSON.parse(value) as T : (value as T) ?? fallback; } catch { return fallback; } };
const mapRecommendation = (r: Row): Recommendation => ({ id: String(r.id), consultationId: String(r.consultation_id), styleName: String(r.style_name), rationale: String(r.rationale), execution: json(r.execution_json, {}), imageUrl: r.image_url ? String(r.image_url) : undefined, rank: Number(r.rank ?? 0), createdAt: String(r.created_at) });
const mapConsultation = (r: Row): Consultation => ({ id: String(r.id), salonId: r.salon_id ? String(r.salon_id) : null, customerUserId: r.customer_user_id ? String(r.customer_user_id) : null, stylistUserId: r.stylist_user_id ? String(r.stylist_user_id) : null, status: String(r.status) as ConsultationStatus, sourcePhotoPath: r.source_photo_path ? String(r.source_photo_path) : null, analysisResult: json(r.analysis_json, null), recommendations: [], selectedRecommendationId: r.selected_recommendation_id ? String(r.selected_recommendation_id) : null, createdAt: String(r.created_at), updatedAt: String(r.updated_at) });
export function findConsultation(id: string): Consultation | null {
  const row = db().prepare("SELECT * FROM consultations WHERE id=?").get(id) as Row | undefined;
  if (!row) return null;
  const item = mapConsultation(row);
  item.recommendations = (db().prepare("SELECT * FROM recommendations WHERE consultation_id=? ORDER BY rank").all(id) as Row[]).map(mapRecommendation);
  return item;
}
export function requireConsultation(id: string, actor: ConsultationActor) { const item = findConsultation(id); if (!item) throw new ConsultationDomainError("CONSULTATION_NOT_FOUND"); assertConsultationAccess(actor, item); return item; }
export function ensureSalon(salonId: string, user: AuthUser) {
  const exists = db().prepare("SELECT id FROM salons WHERE id=?").get(salonId);
  if (!exists) db().prepare("INSERT INTO salons(id,name,stylist_name,email,owner_user_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").run(salonId, user.storeName ?? "Salon", user.name, user.email, user.id, new Date().toISOString(), new Date().toISOString());
}
export function consultationIdForKey(salonId: string, idempotencyKey: string): string {
  return createHash("sha256").update(`${salonId}:${idempotencyKey}`).digest("hex").slice(0, 32);
}
export function createDraft(input: { id?: string; salonId: string; stylistUserId: string; customerUserId?: string | null; sourcePhotoPath?: string | null; idempotencyKey?: string }) {
  const id = input.id ?? (input.idempotencyKey ? consultationIdForKey(input.salonId, input.idempotencyKey) : randomUUID());
  const existing = findConsultation(id); if (existing) return { item: existing, created: false };
  const now = new Date().toISOString();
  db().prepare("INSERT INTO consultations(id,salon_id,customer_user_id,stylist_user_id,status,source_photo_path,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)").run(id,input.salonId,input.customerUserId ?? null,input.stylistUserId,"draft",input.sourcePhotoPath ?? null,now,now);
  return { item: findConsultation(id)!, created: true };
}
export function listForActor(actor: ConsultationActor) {
  const rows = actor.role === "consumer" ? db().prepare("SELECT * FROM consultations WHERE customer_user_id=? ORDER BY created_at DESC").all(actor.userId) : db().prepare("SELECT * FROM consultations WHERE salon_id=? ORDER BY created_at DESC").all(actor.tenantId);
  return (rows as Row[]).map(mapConsultation).map((x) => { x.recommendations=(db().prepare("SELECT * FROM recommendations WHERE consultation_id=? ORDER BY rank").all(x.id) as Row[]).map(mapRecommendation); return x; });
}
export function analyze(item: Consultation) {
  assertStatusTransition(item.status, "analyzing");
  db().prepare("UPDATE consultations SET status='analyzing',updated_at=? WHERE id=?").run(new Date().toISOString(), item.id);
  try {
    const report = createFallbackConsultation("low_confidence"); const now = new Date().toISOString(); const d = db();
    d.prepare("DELETE FROM recommendations WHERE consultation_id=?").run(item.id);
    report.recommendations.forEach((r, i) => d.prepare("INSERT INTO recommendations(id,consultation_id,style_name,rationale,execution_json,rank,created_at) VALUES(?,?,?,?,?,?,?)").run(randomUUID(), item.id, r.styleName, r.fitReason, JSON.stringify({ suitableFor:r.suitableFor, maintenanceMinutes:String(r.maintenanceMinutes), maintenanceLevel:r.maintenanceLevel, advice:r.executionAdvice.join(" ") }), i+1, now));
    d.prepare("UPDATE consultations SET status='ready',analysis_json=?,generated_images_json=?,updated_at=? WHERE id=?").run(JSON.stringify(report.analysis), JSON.stringify([]), now, item.id);
  } catch (error) { db().prepare("UPDATE consultations SET status='draft',updated_at=? WHERE id=?").run(new Date().toISOString(), item.id); throw error; }
  return findConsultation(item.id)!;
}
export function selectRecommendation(item: Consultation, id: string) {
  assertRecommendationBelongsToConsultation(item.recommendations.find((r) => r.id === id), item.id); assertStatusTransition(item.status, "completed");
  db().prepare("UPDATE consultations SET selected_recommendation_id=?,status='completed',updated_at=? WHERE id=?").run(id,new Date().toISOString(),item.id); return findConsultation(item.id)!;
}
export function archive(item: Consultation) { assertStatusTransition(item.status,"archived"); db().prepare("UPDATE consultations SET status='archived',updated_at=? WHERE id=?").run(new Date().toISOString(),item.id); return findConsultation(item.id)!; }
