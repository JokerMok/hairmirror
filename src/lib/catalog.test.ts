import { describe, expect, it } from "vitest";
import { recommendTemplates } from "./catalog";

describe("recommendTemplates", () => {
  it("returns three ranked templates", () => {
    const result = recommendTemplates({
      audience: "feminine",
      targetLength: "long",
      goal: "younger",
      chemical: true,
    });
    expect(result).toHaveLength(3);
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
      expect(result).toHaveLength(3);
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

    expect(result.some((item) => item.id === "soft-waves")).toBe(false);
    expect(result.every((item) => !item.requiresTreatment)).toBe(true);
  });
});
