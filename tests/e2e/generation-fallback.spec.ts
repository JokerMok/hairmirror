import { describe, expect, it } from "vitest";
import { HAIRSTYLES } from "../../src/lib/catalog";
import { generateHairstyleImages } from "../../src/lib/generation-provider";
import { DEFAULT_DESIGN_PREFERENCES } from "../../src/lib/types";

describe("generation provider fallback", () => {
  it("returns stable local demo assets when no external provider is configured", async () => {
    const runtime = {
      id: "local",
      name: "Local demo",
      provider: "local",
      model: "demo-fixed",
      endpoint: "",
      hasApiKey: false,
      apiKeyMasked: null,
      apiKey: null,
      enabled: true,
      priority: 1,
      timeoutMs: 5000,
      costPerImageMicros: 0,
      currency: "USD",
      updatedAt: new Date().toISOString(),
    } as const;
    const templates = HAIRSTYLES.filter((template) =>
      ["clean-side", "textured-crop", "french-bob"].includes(template.id),
    );

    const result = await generateHairstyleImages(
      templates,
      {
        taskId: "fallback-task",
        ownerSessionId: "fallback-owner",
        userId: null,
        preferences: DEFAULT_DESIGN_PREFERENCES,
      },
      runtime,
    );

    expect(result.mode).toBe("demo-fixed");
    expect(Object.keys(result.imageUrls)).toEqual(
      expect.arrayContaining(templates.map((template) => template.id)),
    );
    expect(Object.values(result.imageUrls).every((url) => url.startsWith("/demo-results/"))).toBe(
      true,
    );
  });
});
