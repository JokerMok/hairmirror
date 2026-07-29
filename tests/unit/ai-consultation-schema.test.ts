import { describe, expect, it } from "vitest";

import {
  ConsultationReportSchema,
  parseConsultationReport,
} from "@/lib/ai-consultation-schema";

const validReport = {
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

describe("consultation report schema", () => {
  it("parses the complete structured contract", () => {
    expect(parseConsultationReport(validReport)).toEqual(validReport);
  });

  it("requires limitations in every analysis", () => {
    const invalid = {
      ...validReport,
      analysis: { ...validReport.analysis, limitations: undefined },
    };

    expect(() => ConsultationReportSchema.parse(invalid)).toThrow();
  });

  it("rejects more than three recommendations", () => {
    const invalid = {
      ...validReport,
      recommendations: [
        ...validReport.recommendations,
        { ...validReport.recommendations[0], styleName: "Modern Side Part" },
        { ...validReport.recommendations[0], styleName: "Soft Waves" },
        { ...validReport.recommendations[0], styleName: "Long Layers" },
      ],
    };

    expect(() => ConsultationReportSchema.parse(invalid)).toThrow();
  });

  it("rejects sensitive inference fields and text", () => {
    expect(() =>
      ConsultationReportSchema.parse({
        ...validReport,
        analysis: { ...validReport.analysis, gender: "unknown" },
      }),
    ).toThrow();

    expect(() =>
      ConsultationReportSchema.parse({
        ...validReport,
        explanation: "Possible medical condition detected.",
      }),
    ).toThrow();
  });

  it("bounds confidence and maintenance time", () => {
    expect(() =>
      ConsultationReportSchema.parse({
        ...validReport,
        analysis: { ...validReport.analysis, confidence: 1.1 },
      }),
    ).toThrow();

    expect(() =>
      ConsultationReportSchema.parse({
        ...validReport,
        recommendations: [
          { ...validReport.recommendations[0], maintenanceMinutes: -1 },
        ],
      }),
    ).toThrow();
  });
});
