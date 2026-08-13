export type HairLength = "short" | "medium" | "long";
export type HairGoal =
  | "fresh"
  | "younger"
  | "volume"
  | "professional"
  | "fashion";

export interface HairstyleTemplate {
  id: string;
  name: string;
  audience: "all" | "masculine" | "feminine";
  length: HairLength;
  goal: HairGoal[];
  maintenance: "低" | "中" | "高";
  conditions: string;
  description: string;
  visual: "crop" | "waves" | "layer";
  color: string;
}

export interface DesignPreferences {
  audience: "masculine" | "feminine" | "neutral";
  currentLength: HairLength;
  targetLength: HairLength;
  goal: HairGoal;
  texture: "straight" | "wavy" | "curly" | "coily";
  density: "fine" | "medium" | "thick";
  faceShape: "auto" | "oval" | "round" | "square" | "heart" | "long";
  fringe: "open" | "avoid" | "soft" | "full";
  parting: "auto" | "center" | "side";
  chemical: boolean;
  dailyMinutes: number;
}

export type ConsultationBrief = Pick<
  DesignPreferences,
  "currentLength" | "targetLength" | "goal" | "chemical" | "dailyMinutes"
>;

export const DEFAULT_DESIGN_PREFERENCES: DesignPreferences = {
  audience: "neutral",
  currentLength: "short",
  targetLength: "short",
  goal: "fresh",
  texture: "straight",
  density: "medium",
  faceShape: "auto",
  fringe: "open",
  parting: "auto",
  chemical: false,
  dailyMinutes: 5,
};

export function normalizeDesignPreferences(
  value: Partial<DesignPreferences> | null | undefined,
): DesignPreferences {
  return { ...DEFAULT_DESIGN_PREFERENCES, ...(value ?? {}) };
}

export interface DesignVariant {
  id: string;
  template: HairstyleTemplate;
  reason: string;
  resultImageUrl?: string;
}

export interface DesignTask {
  id: string;
  status:
    | "queued"
    | "processing"
    | "completed"
    | "failed"
    | "cancelled"
    | "deleted";
  createdAt: string;
  preferences: DesignPreferences;
  variants: DesignVariant[];
  generationMode: "demo-fixed" | "mock" | "api";
  selectedVariantId?: string;
  errorCode?: string;
}

export interface StoredDesignTask extends DesignTask {
  ownerSessionId: string;
  userId: string | null;
}

export interface TaskFeedback {
  id: string;
  taskId: string;
  variantId: string;
  helpful: boolean;
  issue?: string;
  createdAt: string;
}

/** Roles that can participate in an AI hair consultation. */
export type ConsultationActorRole = "consumer" | "stylist" | "salon_admin";

export type ConsultationStatus =
  | "draft"
  | "analyzing"
  | "ready"
  | "shared"
  | "completed"
  | "archived";

export const CONSULTATION_STATUSES: readonly ConsultationStatus[] = [
  "draft",
  "analyzing",
  "ready",
  "shared",
  "completed",
  "archived",
];

export type ConsultationErrorCode =
  | "CONSULTATION_NOT_FOUND"
  | "CONSULTATION_FORBIDDEN"
  | "INVALID_STATUS_TRANSITION"
  | "INVALID_CONSULTATION_INPUT"
  | "RECOMMENDATION_NOT_FOUND"
  | "TENANT_REQUIRED"
  | "CONSENT_REQUIRED"
  | "SOURCE_IMAGE_QUALITY_INVALID"
  | "CUSTOMER_NOT_FOUND";

export interface Salon {
  id: string;
  name: string;
  stylistName?: string | null;
  email?: string | null;
  ownerUserId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecommendationExecution {
  sides?: string;
  top?: string;
  texture?: string;
  style?: string;
  [key: string]: string | undefined;
}

export interface Recommendation {
  id: string;
  consultationId: string;
  styleName: string;
  rationale: string;
  execution: RecommendationExecution;
  imageUrl?: string | null;
  rank: number;
  createdAt: string;
}

export type ConsultationGenerationJobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export type ConsultationGenerationStatus =
  | "idle"
  | "queued"
  | "processing"
  | "partial"
  | "completed"
  | "failed"
  | "cancelled";

export interface SourceImageQuality {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  bytes: number;
  width: number;
  height: number;
  passed: boolean;
  reasons: string[];
}

export interface ConsultationGenerationJob {
  consultationId: string;
  recommendationId: string;
  taskId: string;
  jobId: string;
  status: ConsultationGenerationJobStatus;
  attempts: number;
  maxAttempts: number;
  errorCode: string | null;
}

export interface Consultation {
  id: string;
  salonId: string | null;
  customerUserId: string | null;
  stylistUserId: string | null;
  status: ConsultationStatus;
  sourcePhotoPath: string | null;
  analysisResult: Record<string, unknown> | null;
  recommendations: Recommendation[];
  selectedRecommendationId: string | null;
  generationStatus: ConsultationGenerationStatus;
  sourceConsentAt: string | null;
  sourceConsentVersion: string | null;
  sourceQuality: SourceImageQuality | null;
  generationJobs?: ConsultationGenerationJob[];
  createdAt: string;
  updatedAt: string;
}
