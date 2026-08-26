import { describe, expect, it } from "vitest";
import { designPreferencesSchema } from "./preference-schema";
import {
  DEFAULT_DESIGN_PREFERENCES,
  getHairColorPreferenceError,
  normalizeDesignPreferences,
} from "./types";

describe("design preference validation", () => {
  it("rejects a color change without a target color", () => {
    const result = designPreferencesSchema.safeParse({
      ...DEFAULT_DESIGN_PREFERENCES,
      colorMode: "change",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["targetHairColor"]);
      expect(result.error.issues[0]?.message).toBe("TARGET_HAIR_COLOR_REQUIRED");
    }
  });

  it("rejects the empty select placeholder as an unselected target", () => {
    const result = designPreferencesSchema.safeParse({
      ...DEFAULT_DESIGN_PREFERENCES,
      colorMode: "change",
      targetHairColor: "",
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues.some((issue) => issue.message === "TARGET_HAIR_COLOR_REQUIRED")).toBe(true);
  });

  it("requires a description for a custom target color", () => {
    const result = designPreferencesSchema.safeParse({
      ...DEFAULT_DESIGN_PREFERENCES,
      colorMode: "change",
      targetHairColor: "custom",
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues.some((issue) => issue.message === "CUSTOM_HAIR_COLOR_REQUIRED")).toBe(true);
  });

  it("rejects a whitespace-only custom color and keeps preserve independent", () => {
    expect(
      getHairColorPreferenceError({
        colorMode: "change",
        targetHairColor: "custom",
        customHairColor: "   ",
      }),
    ).toBe("CUSTOM_HAIR_COLOR_REQUIRED");
    expect(
      designPreferencesSchema.safeParse({
        ...DEFAULT_DESIGN_PREFERENCES,
        colorMode: "preserve",
        targetHairColor: "dark_brown",
      }).success,
    ).toBe(true);
    expect(
      normalizeDesignPreferences({
        ...DEFAULT_DESIGN_PREFERENCES,
        colorMode: "preserve",
        targetHairColor: "dark_brown",
      }).targetHairColor,
    ).toBeUndefined();
  });

  it("accepts a named target color", () => {
    const result = designPreferencesSchema.safeParse({
      ...DEFAULT_DESIGN_PREFERENCES,
      colorMode: "change",
      targetHairColor: "dark_brown",
    });
    expect(result.success).toBe(true);
  });
});
