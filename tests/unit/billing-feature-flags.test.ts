import { describe, expect, it } from "vitest";
import {
  getBillingFeatureState,
  shouldShowBillingCta,
} from "@/lib/billing-feature-flags";

describe("billing feature flags", () => {
  it("keeps paid entry points paused by default", () => {
    expect(getBillingFeatureState({})).toEqual({
      billingPaused: true,
      showPaidPlans: false,
      showCheckoutCta: false,
    });
    expect(shouldShowBillingCta({})).toBe(false);
  });

  it("enables paid entry points only when explicitly enabled", () => {
    expect(getBillingFeatureState({ BILLING_PAUSED: "false" })).toEqual({
      billingPaused: false,
      showPaidPlans: true,
      showCheckoutCta: true,
    });
    expect(shouldShowBillingCta({ BILLING_PAUSED: "off" })).toBe(true);
  });

  it("falls back to the safe paused state for invalid values", () => {
    expect(getBillingFeatureState({ BILLING_PAUSED: "maybe" }).billingPaused).toBe(true);
  });
});
