import type { DatabaseSync } from "node:sqlite";
import type { AuthUser } from "./database";
import { removeSourceImage } from "./source-storage";
import {
  assertConsultationAccess,
  ConsultationDomainError,
  type ConsultationActor,
} from "./consultation-domain";
import type {
  Consultation,
  ConsultationActorRole,
  ConsultationStatus,
  Recommendation,
  RecommendationExecution,
} from "./types";

export const CONSULTATION_RETENTION_DAYS = 30;

export type PublicConsultation = Omit<Consultation, "sourcePhotoPath"> & {
  generatedImages: unknown[] | null;
};

export function consultationRetentionCutoff(now = Date.now()): string {
  return new Date(now - CONSULTATION_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export function isConsultationExpired(createdAt: string, now = Date.now()): boolean {
  const timestamp = Date.parse(createdAt);
  return Number.isFinite(timestamp) && timestamp < Date.parse(consultationRetentionCutoff(now));
}

export function actorFromAuthUser(user: AuthUser): ConsultationActor {
  const role: ConsultationActorRole =
    user.role === "personal"
      ? "consumer"
      : user.role === "staff"
        ? "stylist"
        : "salon_admin";
  return { userId: user.id, tenantId: role === "consumer" ? null : user.storeId, role };
}

function parseJson(value: unknown): unknown {
  if (typeof value !== "string" || value.trim() === "") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseAnalysis(value: unknown): Record<string, unknown> | null {
  const parsed = parseJson(value);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : null;
}

function parseGeneratedImages(value: unknown): unknown[] | null {
  const parsed = parseJson(value);
  return Array.isArray(parsed) ? parsed : null;
}

function parseExecution(value: unknown): RecommendationExecution {
  const parsed = parseJson(value);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as RecommendationExecution)
    : {};
}

type ConsultationRow = {
  id: string;
  salon_id: string | null;
  customer_user_id: string | null;
  stylist_user_id: string | null;
  status: string;
  source_photo_path: string | null;
  analysis_json: string | null;
  generated_images_json: string | null;
  selected_recommendation_id: string | null;
  created_at: string;
  updated_at: string;
};

type RecommendationRow = {
  id: string;
  consultation_id: string;
  style_name: string;
  rationale: string;
  execution_json: string;
  image_url: string | null;
  rank: number;
  created_at: string;
};

function mapRecommendation(row: RecommendationRow): Recommendation {
  return {
    id: row.id,
    consultationId: row.consultation_id,
    styleName: row.style_name,
    rationale: row.rationale,
    execution: parseExecution(row.execution_json),
    imageUrl: row.image_url,
    rank: Number(row.rank),
    createdAt: row.created_at,
  };
}

function mapConsultation(
  row: ConsultationRow,
  recommendations: Recommendation[],
): Consultation & { generatedImages: unknown[] | null } {
  const status = row.status as ConsultationStatus;
  return {
    id: row.id,
    salonId: row.salon_id,
    customerUserId: row.customer_user_id,
    stylistUserId: row.stylist_user_id,
    status,
    sourcePhotoPath: row.source_photo_path,
    analysisResult: parseAnalysis(row.analysis_json),
    recommendations,
    selectedRecommendationId: row.selected_recommendation_id,
    generatedImages: parseGeneratedImages(row.generated_images_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getRecommendations(database: DatabaseSync, consultationId: string): Recommendation[] {
  const rows = database
    .prepare(
      `SELECT id,consultation_id,style_name,rationale,execution_json,image_url,rank,created_at
       FROM recommendations WHERE consultation_id=? ORDER BY rank ASC,created_at ASC`,
    )
    .all(consultationId) as unknown as RecommendationRow[];
  return rows.map(mapRecommendation);
}

function getRow(database: DatabaseSync, id: string): ConsultationRow | null {
  const row = database
    .prepare(
      `SELECT id,salon_id,customer_user_id,stylist_user_id,status,source_photo_path,
              analysis_json,generated_images_json,selected_recommendation_id,created_at,updated_at
       FROM consultations WHERE id=?`,
    )
    .get(id) as unknown as ConsultationRow | undefined;
  return row ?? null;
}

export function getConsultation(database: DatabaseSync, id: string): Consultation | null {
  const row = getRow(database, id);
  return row ? mapConsultation(row, getRecommendations(database, id)) : null;
}

export function getPublicConsultation(
  database: DatabaseSync,
  id: string,
  actor: ConsultationActor,
): PublicConsultation | null {
  const consultation = getConsultation(database, id);
  if (!consultation) return null;
  assertConsultationAccess(actor, consultation);
  const publicConsultation = { ...consultation } as PublicConsultation & {
    sourcePhotoPath?: string | null;
  };
  delete publicConsultation.sourcePhotoPath;
  return publicConsultation;
}

export function listConsultations(
  database: DatabaseSync,
  actor: ConsultationActor,
): PublicConsultation[] {
  const rows = actor.role === "consumer"
    ? database
        .prepare(
          `SELECT id,salon_id,customer_user_id,stylist_user_id,status,source_photo_path,
                  analysis_json,generated_images_json,selected_recommendation_id,created_at,updated_at
           FROM consultations WHERE customer_user_id=? ORDER BY created_at DESC`,
        )
        .all(actor.userId)
    : actor.tenantId
      ? database
          .prepare(
            `SELECT id,salon_id,customer_user_id,stylist_user_id,status,source_photo_path,
                    analysis_json,generated_images_json,selected_recommendation_id,created_at,updated_at
             FROM consultations WHERE salon_id=? ORDER BY created_at DESC`,
          )
          .all(actor.tenantId)
      : [];
  return (rows as unknown as ConsultationRow[]).map((row) => {
    const consultation = mapConsultation(row, getRecommendations(database, row.id));
    const publicConsultation = { ...consultation } as PublicConsultation & {
      sourcePhotoPath?: string | null;
    };
    delete publicConsultation.sourcePhotoPath;
    return publicConsultation;
  });
}

export function deleteExpiredConsultations(database: DatabaseSync, now = Date.now()): number {
  const expired = database
    .prepare("SELECT id,source_photo_path FROM consultations WHERE created_at < ?")
    .all(consultationRetentionCutoff(now)) as unknown as Array<{ id: string; source_photo_path: string | null }>;
  for (const row of expired) {
    if (row.source_photo_path) {
      try {
        removeSourceImage(row.source_photo_path);
      } catch {
        // Retention must continue even if an already-missing asset cannot be removed.
      }
    }
  }
  const result = database.prepare("DELETE FROM consultations WHERE created_at < ?").run(consultationRetentionCutoff(now));
  return Number(result.changes ?? 0);
}

export function deleteConsultation(database: DatabaseSync, id: string, actor: ConsultationActor): void {
  const consultation = getConsultation(database, id);
  if (!consultation) throw new ConsultationDomainError("CONSULTATION_NOT_FOUND");
  assertConsultationAccess(actor, consultation);
  if (consultation.sourcePhotoPath) {
    try {
      removeSourceImage(consultation.sourcePhotoPath);
    } catch {
      // The database record remains authoritative; missing files are already deleted.
    }
  }
  database.prepare("DELETE FROM consultations WHERE id=?").run(id);
}
