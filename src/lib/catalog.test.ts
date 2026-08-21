import { describe, expect, it } from "vitest";
import { HAIRSTYLES, HAIRSTYLE_DIRECTION_COUNT, recommendTemplates } from "./catalog";

describe("recommendTemplates", () => {
  it("returns three ranked templates", () => {
    const result = recommendTemplates({
      audience: "feminine",
      targetLength: "long",
      goal: "younger",
      treatmentMode: "perm_allowed",
    });
    expect(result).toHaveLength(HAIRSTYLE_DIRECTION_COUNT);
    expect(result.every((item) => item.length === "long")).toBe(true);
  });
  it("supports masculine short hair", () => {
    const result = recommendTemplates({
      audience: "masculine",
      targetLength: "short",
      goal: "fresh",
      treatmentMode: "perm_allowed",
    });
    expect(result.some((item) => item.id === "textured-crop")).toBe(true);
  });
  it.each(["short", "medium", "long"] as const)(
    "never recommends a different target length: %s",
    (targetLength) => {
      const result = recommendTemplates({
        audience: "neutral",
        targetLength,
        goal: "fashion",
        treatmentMode: "perm_allowed",
      });
      expect(result).toHaveLength(HAIRSTYLE_DIRECTION_COUNT);
      expect(result.every((item) => item.length === targetLength)).toBe(true);
    },
  );

  it("excludes styles that may require treatment when the user chooses cut only", () => {
    const result = recommendTemplates({
      audience: "neutral",
      targetLength: "medium",
      goal: "volume",
      treatmentMode: "cut_only",
    });

    expect(result).toHaveLength(HAIRSTYLE_DIRECTION_COUNT);
    expect(result.some((item) => item.id === "soft-waves")).toBe(false);
    expect(result.some((item) => item.id === "straight-layer")).toBe(true);
    expect(result.every((item) => !item.requiresPermOrHeat)).toBe(true);
  });

  it("returns exactly three unique safe templates for every legal preference combination", () => {
    const audiences = ["neutral", "masculine", "feminine"];
    const targetLengths = ["short", "medium", "long"];
    const goals = ["fresh", "younger", "volume", "professional", "fashion"] as const;

    for (const audience of audiences) {
      for (const targetLength of targetLengths) {
        for (const goal of goals) {
          for (const treatmentMode of ["cut_only", "perm_allowed"] as const) {
            const result = recommendTemplates({ audience, targetLength, goal, treatmentMode });
            expect(result).toHaveLength(HAIRSTYLE_DIRECTION_COUNT);
            expect(new Set(result.map((item) => item.id)).size).toBe(HAIRSTYLE_DIRECTION_COUNT);
            expect(result.every((item) => item.length === targetLength)).toBe(true);
            if (treatmentMode === "cut_only") expect(result.every((item) => !item.requiresPermOrHeat)).toBe(true);
          }
        }
      }
    }
  });

  it("keeps color independent from template selection", () => {
    const cutOnly = recommendTemplates({
      audience: "neutral",
      targetLength: "medium",
      goal: "volume",
      treatmentMode: "cut_only",
    });
    const permAllowed = recommendTemplates({
      audience: "neutral",
      targetLength: "medium",
      goal: "volume",
      treatmentMode: "perm_allowed",
    });
    expect(cutOnly.every((item) => !item.requiresPermOrHeat)).toBe(true);
    expect(permAllowed.some((item) => item.id === "soft-waves")).toBe(true);
  });

  it("does not include implicit dye instructions in any template", () => {
    for (const template of HAIRSTYLES) {
      const text = `${template.name} ${template.description} ${template.conditions}`;
      expect(text).not.toMatch(/染发|漂发|挑染|发色|dye|bleach|highlight|recolor/i);
    }
  });
});
