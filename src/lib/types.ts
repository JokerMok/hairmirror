export type HairLength = "short" | "medium" | "long";
export type HairGoal =
  | "fresh"
  | "younger"
  | "volume"
  | "professional"
  | "fashion";

export type TreatmentMode = "cut_only" | "perm_allowed";
export type HairColorMode = "preserve" | "change";
export type HairColorPreset =
  | "black"
  | "dark_brown"
  | "brown"
  | "blonde"
  | "red"
  | "gray"
  | "custom";

export const HAIR_COLOR_PRESETS: readonly HairColorPreset[] = [
  "black",
  "dark_brown",
  "brown",
  "blonde",
  "red",
  "gray",
  "custom",
];

export interface HairstyleTemplate {
  id: string;
  name: string;
  audience: "all" | "masculine" | "feminine";
  length: HairLength;
  goal: HairGoal[];
  maintenance: "低" | "中" | "高";
  conditions: string;
  /** The style may require perming or heat-curling tools. */
  requiresPermOrHeat?: boolean;
  description: string;
  visual: "crop" | "waves" | "layer";
  /** Only used by the local placeholder preview; never sent as a hair-color instruction. */
  previewColor: string;
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
  treatmentMode: TreatmentMode;
  colorMode: HairColorMode;
  targetHairColor?: HairColorPreset;
  customHairColor?: string;
  dailyMinutes: number;
}

export interface ConsultationBrief {
  currentLength: HairLength;
  targetLength: HairLength;
  goal: HairGoal;
  treatmentMode: TreatmentMode;
  colorMode: HairColorMode;
  targetHairColor?: HairColorPreset;
  customHairColor?: string;
  dailyMinutes: number;
}

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
  treatmentMode: "cut_only",
  colorMode: "preserve",
  dailyMinutes: 5,
};

type LegacyDesignPreferences = Partial<DesignPreferences> & {
  chemical?: boolean;
};

function isHairColorPreset(value: unknown): value is HairColorPreset {
  return typeof value === "string" && HAIR_COLOR_PRESETS.includes(value as HairColorPreset);
}

export function normalizeDesignPreferences(
  value: LegacyDesignPreferences | null | undefined,
): DesignPreferences {
  const raw = value ?? {};
  const legacyChemical = raw.chemical;
  const treatmentMode =
    raw.treatmentMode === "cut_only" || raw.treatmentMode === "perm_allowed"
      ? raw.treatmentMode
      : legacyChemical === true
        ? "perm_allowed"
        : DEFAULT_DESIGN_PREFERENCES.treatmentMode;
  const colorMode = raw.colorMode === "change" ? "change" : "preserve";
  const targetHairColor =
    colorMode === "change" && isHairColorPreset(raw.targetHairColor)
      ? raw.targetHairColor
      : undefined;
  const customHairColor =
    targetHairColor === "custom" && typeof raw.customHairColor === "string"
      ? raw.customHairColor.trim().slice(0, 80) || undefined
      : undefined;

  return {
    ...DEFAULT_DESIGN_PREFERENCES,
    audience: raw.audience ?? DEFAULT_DESIGN_PREFERENCES.audience,
    currentLength: raw.currentLength ?? DEFAULT_DESIGN_PREFERENCES.currentLength,
    targetLength: raw.targetLength ?? DEFAULT_DESIGN_PREFERENCES.targetLength,
    goal: raw.goal ?? DEFAULT_DESIGN_PREFERENCES.goal,
    texture: raw.texture ?? DEFAULT_DESIGN_PREFERENCES.texture,
    density: raw.density ?? DEFAULT_DESIGN_PREFERENCES.density,
    faceShape: raw.faceShape ?? DEFAULT_DESIGN_PREFERENCES.faceShape,
    fringe: raw.fringe ?? DEFAULT_DESIGN_PREFERENCES.fringe,
    parting: raw.parting ?? DEFAULT_DESIGN_PREFERENCES.parting,
    treatmentMode,
    colorMode,
    targetHairColor,
    customHairColor,
    dailyMinutes: raw.dailyMinutes ?? DEFAULT_DESIGN_PREFERENCES.dailyMinutes,
  };
}

export function normalizeConsultationBrief(
  value: Partial<ConsultationBrief> & { chemical?: boolean } | null | undefined,
): ConsultationBrief {
  const preferences = normalizeDesignPreferences(value);
  return {
    currentLength: preferences.currentLength,
    targetLength: preferences.targetLength,
    goal: preferences.goal,
    treatmentMode: preferences.treatmentMode,
    colorMode: preferences.colorMode,
    targetHairColor: preferences.targetHairColor,
    customHairColor: preferences.customHairColor,
    dailyMinutes: preferences.dailyMinutes,
  };
}

export function targetHairColorText(
  preferences: Pick<DesignPreferences, "colorMode" | "targetHairColor" | "customHairColor">,
) {
  if (preferences.colorMode !== "change" || !preferences.targetHairColor) return null;
  if (preferences.targetHairColor === "custom") return preferences.customHairColor?.trim() || null;
  return {
    black: "Black",
    dark_brown: "Dark brown",
    brown: "Brown",
    blonde: "Blonde",
    red: "Red",
    gray: "Gray",
  }[preferences.targetHairColor];
}

export function hasValidHairColorPreference(
  preferences: Pick<DesignPreferences, "colorMode" | "targetHairColor" | "customHairColor">,
) {
  if (preferences.colorMode === "preserve") return true;
  if (!preferences.targetHairColor) return false;
  return preferences.targetHairColor !== "custom" || Boolean(preferences.customHairColor?.trim());
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
