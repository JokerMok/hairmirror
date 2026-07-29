import type { DesignPreferences, HairstyleTemplate } from "./types";
import { getActiveModelRuntime, type ModelRuntime } from "./model-operations";
import { generateWithRunningHub } from "./runninghub-provider";

export type GenerationResult = {
  mode: "demo-fixed" | "mock" | "api";
  imageUrls: Record<string, string>;
  actualCostMicros: number;
};

type GenerationContext = {
  taskId: string;
  ownerSessionId: string;
  userId: string | null;
  preferences: DesignPreferences;
  imageDataUrl?: string;
};

const DEMO_IMAGES: Record<string, string> = {
  "clean-side": "/demo-results/natural-side-part.png",
  "textured-crop": "/demo-results/textured-crop.png",
  "french-bob": "/demo-results/french-bob.png",
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
          "https://www.runninghub.cn/openapi/v2/rhart-image-n-g31-flash-lite/image-to-image",
        apiKey: active.apiKey,
        timeoutMs: active.timeoutMs,
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
