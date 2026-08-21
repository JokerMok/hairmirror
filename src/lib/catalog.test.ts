import { describe, expect, it } from "vitest";
import { HAIRSTYLE_DIRECTION_COUNT, recommendTemplates } from "./catalog";

describe("recommendTemplates", () => {
  it("returns three ranked templates", () => {
    const result = recommendTemplates({
      audience: "feminine",
      targetLength: "long",
      goal: "younger",
      chemical: true,
    });
    expect(result).toHaveLength(HAIRSTYLE_DIRECTION_COUNT);
    expect(result.every((item) => item.length === "long")).toBe(true);
  });
  it("supports masculine short hair", () => {
    const result = recommendTemplates({
      audience: "masculine",
      targetLength: "short",
      goal: "fresh",
      chemical: true,
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
        chemical: true,
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
      chemical: false,
    });

    expect(result).toHaveLength(HAIRSTYLE_DIRECTION_COUNT);
    expect(result.some((item) => item.id === "soft-waves")).toBe(false);
    expect(result.some((item) => item.id === "straight-layer")).toBe(true);
    expect(result.every((item) => !item.requiresTreatment)).toBe(true);
  });

  it("returns exactly three unique safe templates for every legal preference combination", () => {
    const audiences = ["neutral", "masculine", "feminine"];
    const targetLengths = ["short", "medium", "long"];
    const goals = ["fresh", "younger", "volume", "professional", "fashion"] as const;

    for (const audience of audiences) {
      for (const targetLength of targetLengths) {
        for (const goal of goals) {
          for (const chemical of [false, true]) {
            const result = recommendTemplates({ audience, targetLength, goal, chemical });
            expect(result).toHaveLength(HAIRSTYLE_DIRECTION_COUNT);
            expect(new Set(result.map((item) => item.id)).size).toBe(HAIRSTYLE_DIRECTION_COUNT);
            expect(result.every((item) => item.length === targetLength)).toBe(true);
            if (!chemical) expect(result.every((item) => !item.requiresTreatment)).toBe(true);
          }
        }
      }
    }
  });
});
