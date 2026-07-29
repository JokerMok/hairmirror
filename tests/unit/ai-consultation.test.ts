import { describe, expect, it } from "vitest";

import {
  runConsultation,
  type ConsultationProvider,
} from "@/lib/ai-consultation";

const providerReport = {
  version: "v0.3" as const,
  status: "complete" as const,
  source: "provider" as const,
  explanation: "The image is clear enough for a practical first recommendation.",
  analysis: {
    faceShape: "oval" as const,
    headShape: "balanced",
    hairType: "straight" as const,
    currentCharacteristics: ["The sides look fuller than the top."],
    confidence: 0.82,
    limitations: ["Lighting and camera angle may affect the assessment."],
  },
  recommendations: [
    {
      styleName: "Textured Crop",
      fitReason: "Adds texture without making the face look longer.",
      suitableFor: "Everyday wear",
      maintenanceMinutes: 3,
      maintenanceLevel: "low" as const,
      executionAdvice: ["Keep 4 to 5 cm on top.", "Use a soft taper on the sides."],
    },
  ],
};

describe("runConsultation", () => {
  it("returns a validated provider report", async () => {
    const provider: ConsultationProvider = {
      analyze: async () => providerReport,
    };

    const result = await runConsultation(provider, { imageId: "photo-1" });

    expect(result.source).toBe("provider");
    expect(result.reason).toBeUndefined();
    expect(result.report.status).toBe("complete");
  });

  it("keeps invalid provider output out of the UI", async () => {
    const provider: ConsultationProvider = {
      analyze: async () => ({ broken: true }),
    };

    const result = await runConsultation(provider, { imageId: "photo-1" });

    expect(result.source).toBe("fallback");
    expect(result.reason).toBe("invalid_output");
    expect(result.report.status).toBe("fallback");
    expect(result.report.explanation.length).toBeGreaterThan(0);
  });

  it("returns a displayable fallback when the provider times out", async () => {
    const provider: ConsultationProvider = {
      analyze: () => new Promise((resolve) => setTimeout(() => resolve(providerReport), 50)),
    };

    const result = await runConsultation(provider, { imageId: "photo-1" }, { timeoutMs: 5 });

    expect(result.source).toBe("fallback");
    expect(result.reason).toBe("timeout");
    expect(result.report.status).toBe("fallback");
  });

  it("marks low-confidence reports with an explanation", async () => {
    const provider: ConsultationProvider = {
      analyze: async () => ({
        ...providerReport,
        analysis: { ...providerReport.analysis, confidence: 0.35 },
      }),
    };

    const result = await runConsultation(provider, { imageId: "photo-1" });

    expect(result.source).toBe("provider");
    expect(result.report.status).toBe("low_confidence");
    expect(result.report.explanation).toContain("confidence");
  });

  it("uses deterministic, bounded fallback recommendations", async () => {
    const provider: ConsultationProvider = {
      analyze: async () => {
        throw new Error("provider unavailable");
      },
    };

    const first = await runConsultation(provider, { imageId: "photo-1" });
    const second = await runConsultation(provider, { imageId: "photo-2" });

    expect(first.report).toEqual(second.report);
    expect(first.report.recommendations.length).toBeLessThanOrEqual(3);
    expect(
      first.report.recommendations.every(
        (item: { maintenanceMinutes: number }) => item.maintenanceMinutes >= 0,
      ),
    ).toBe(true);
    expect(JSON.stringify(first.report)).not.toMatch(/gender|medical|diagnos|race|ethnicity/i);
  });
});
