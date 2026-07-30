import { getFeatureFlags, isBillingPaused } from "./feature-flags";

export interface BillingFeatureState {
  /** Prevents accidental paid entry points while the validation build is active. */
  billingPaused: boolean;
  showPaidPlans: boolean;
  showCheckoutCta: boolean;
}

export function getBillingFeatureState(
  env: Record<string, string | undefined> = process.env,
): BillingFeatureState {
  const billingPaused = getFeatureFlags(env).billingPaused;
  return {
    billingPaused,
    showPaidPlans: !billingPaused,
    showCheckoutCta: !billingPaused,
  };
}

export function shouldShowBillingCta(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return !isBillingPaused(env);
}
