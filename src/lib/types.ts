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
