import { describe, expect, it } from "vitest";

import { getFeatureFlags, isBillingPaused, parseBooleanFlag } from "../../src/lib/feature-flags";

describe("feature flags", () => {
  it("defaults billing to paused for the validation phase", () => {
    expect(getFeatureFlags({}).billingPaused).toBe(true);
    expect(isBillingPaused({})).toBe(true);
  });

  it("accepts common boolean environment values", () => {
    expect(parseBooleanFlag("true", false)).toBe(true);
    expect(parseBooleanFlag("ON", false)).toBe(true);
    expect(parseBooleanFlag("1", false)).toBe(true);
    expect(parseBooleanFlag("false", true)).toBe(false);
    expect(parseBooleanFlag("off", true)).toBe(false);
    expect(parseBooleanFlag("0", true)).toBe(false);
    expect(getFeatureFlags({ BILLING_PAUSED: "false" }).billingPaused).toBe(false);
  });

  it("uses the fallback for invalid values", () => {
    expect(parseBooleanFlag("maybe", true)).toBe(true);
    expect(parseBooleanFlag("maybe", false)).toBe(false);
  });
});
