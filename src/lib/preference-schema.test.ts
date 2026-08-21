import { describe, expect, it } from "vitest";
import { designPreferencesSchema } from "./preference-schema";
import { DEFAULT_DESIGN_PREFERENCES } from "./types";

describe("design preference validation", () => {
  it("rejects a color change without a target color", () => {
    const result = designPreferencesSchema.safeParse({
      ...DEFAULT_DESIGN_PREFERENCES,
      colorMode: "change",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(["targetHairColor"]);
  });

  it("requires a description for a custom target color", () => {
    const result = designPreferencesSchema.safeParse({
      ...DEFAULT_DESIGN_PREFERENCES,
      colorMode: "change",
      targetHairColor: "custom",
    });
    expect(result.success).toBe(false);
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
