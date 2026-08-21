import type { DesignPreferences, HairstyleTemplate } from "./types";
import { getActiveModelRuntime, type ModelRuntime } from "./model-operations";
import { generateWithRunningHub } from "./runninghub-provider";
import { RUNNINGHUB_INTERNATIONAL_ENDPOINT } from "./database";

export type GenerationResult = {
  mode: "demo-fixed" | "mock" | "api";
  imageUrls: Record<string, string>;
  actualCostMicros: number;
};

export type GenerationContext = {
  taskId: string;
  ownerSessionId: string;
  userId: string | null;
  preferences: DesignPreferences;
  imageDataUrl?: string;
  costPerImageMicros?: number;
  consultationId?: string;
  recommendationId?: string;
};

const DEMO_IMAGES: Record<string, string> = {
  "clean-side": "/demo-results/natural-side-part.png",
  "textured-crop": "/demo-results/textured-crop.png",
  "french-bob": "/demo-results/french-bob.png",
  "soft-waves": "/demo-results/french-bob.png",
  "collar-layer": "/demo-results/french-bob.png",
  "long-layer": "/demo-results/french-bob.png",
  "air-bangs": "/demo-results/french-bob.png",
  "neutral-shag": "/demo-results/textured-crop.png",
  "long-soft-curl": "/demo-results/french-bob.png",
  "sleek-long": "/demo-results/french-bob.png",
};

export async function generateHairstyleImages(
  templates: HairstyleTemplate[],
  context: GenerationContext,
  runtime?: ModelRuntime,
): Promise<GenerationResult> {
  const active = runtime ?? getActiveModelRuntime();
  if (active?.provider === "runninghub") {
    if (!active.apiKey) throw new Error("RUNNINGHUB_API_KEY_MISSING");
    if (!context.imageDataUrl) throw new Error("SOURCE_IMAGE_REQUIRED");
    const output = await generateWithRunningHub(
      {
        endpoint:
          active.endpoint ||
          RUNNINGHUB_INTERNATIONAL_ENDPOINT,
        apiKey: active.apiKey,
        timeoutMs: active.timeoutMs,
        costPerImageMicros:
          context.costPerImageMicros ?? active.costPerImageMicros,
      },
      templates,
      { ...context, imageDataUrl: context.imageDataUrl },
    );
    return { mode: "api", ...output };
  }
  if (active && active.provider !== "local")
    throw new Error("PROVIDER_NOT_IMPLEMENTED");
  const mode = process.env.IMAGE_PROVIDER === "mock" ? "mock" : "demo-fixed";
  if (mode === "mock") return { mode, imageUrls: {}, actualCostMicros: 0 };

  return {
    mode,
    imageUrls: Object.fromEntries(
      templates.flatMap((template) =>
        DEMO_IMAGES[template.id]
          ? [[template.id, DEMO_IMAGES[template.id]]]
          : [],
      ),
    ),
    actualCostMicros: 0,
  };
}
