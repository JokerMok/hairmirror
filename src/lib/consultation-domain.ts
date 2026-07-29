import {
  type Consultation,
  type ConsultationActorRole,
  type ConsultationErrorCode,
  type ConsultationStatus,
  type Recommendation,
  CONSULTATION_STATUSES,
} from "./types";

export interface ConsultationActor {
  userId: string;
  tenantId: string | null;
  role: ConsultationActorRole;
}

export class ConsultationDomainError extends Error {
  readonly code: ConsultationErrorCode;

  constructor(code: ConsultationErrorCode, message?: string) {
    super(message ?? code);
    this.name = "ConsultationDomainError";
    this.code = code;
  }
}

export function isConsultationStatus(value: string): value is ConsultationStatus {
  return (CONSULTATION_STATUSES as readonly string[]).includes(value);
}

const transitions: Record<ConsultationStatus, readonly ConsultationStatus[]> = {
  draft: ["analyzing", "archived"],
  analyzing: ["draft", "ready", "archived"],
  ready: ["shared", "completed", "archived"],
  shared: ["completed", "archived"],
  completed: ["archived"],
  archived: [],
};

export function canTransitionConsultation(
  from: ConsultationStatus,
  to: ConsultationStatus,
): boolean {
  return from === to || transitions[from].includes(to);
}

export function assertStatusTransition(
  from: ConsultationStatus,
  to: ConsultationStatus,
): void {
  if (!canTransitionConsultation(from, to)) {
    throw new ConsultationDomainError(
      "INVALID_STATUS_TRANSITION",
      `Cannot move consultation from ${from} to ${to}`,
    );
  }
}

export function canAccessConsultation(
  actor: ConsultationActor,
  consultation: Pick<Consultation, "salonId" | "customerUserId">,
): boolean {
  if (actor.role === "consumer") {
    return consultation.customerUserId === actor.userId;
  }
  return actor.tenantId !== null && actor.tenantId === consultation.salonId;
}

export function assertConsultationAccess(
  actor: ConsultationActor,
  consultation: Pick<Consultation, "salonId" | "customerUserId">,
): void {
  if (!canAccessConsultation(actor, consultation)) {
    throw new ConsultationDomainError("CONSULTATION_FORBIDDEN");
  }
}

export function assertTenantForSalon(actor: ConsultationActor): string {
  if (actor.tenantId === null) {
    throw new ConsultationDomainError("TENANT_REQUIRED");
  }
  return actor.tenantId;
}

export function assertRecommendationBelongsToConsultation(
  recommendation: Pick<Recommendation, "consultationId"> | undefined,
  consultationId: string,
): void {
  if (!recommendation || recommendation.consultationId !== consultationId) {
    throw new ConsultationDomainError("RECOMMENDATION_NOT_FOUND");
  }
}

export function assertValidConsultationInput(input: {
  salonId?: string | null;
  customerUserId?: string | null;
  sourcePhotoPath?: string | null;
}): void {
  if (!input.salonId && !input.customerUserId) {
    throw new ConsultationDomainError("INVALID_CONSULTATION_INPUT");
  }
  if (input.sourcePhotoPath !== undefined && input.sourcePhotoPath !== null && input.sourcePhotoPath.trim() === "") {
    throw new ConsultationDomainError("INVALID_CONSULTATION_INPUT");
  }
}
