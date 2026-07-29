export type FeatureFlagName = "billingPaused";

export interface FeatureFlags {
  billingPaused: boolean;
}

export function parseBooleanFlag(
  value: string | undefined,
  defaultValue: boolean,
): boolean {
  if (value === undefined) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "on", "yes"].includes(normalized)) return true;
  if (["0", "false", "off", "no"].includes(normalized)) return false;
  return defaultValue;
}

/** Safe defaults keep the V0.3 validation build free of accidental charges. */
export function getFeatureFlags(
  env: Record<string, string | undefined> = process.env,
): FeatureFlags {
  return {
    billingPaused: parseBooleanFlag(env.BILLING_PAUSED, true),
  };
}

export function isBillingPaused(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return getFeatureFlags(env).billingPaused;
}
