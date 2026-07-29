export const SITE_NAME = "HairMirror";
export const SITE_URL = (
  process.env.PUBLIC_APP_URL || "https://web-production-eeda8.up.railway.app"
).replace(/\/$/, "");
export const SITE_DESCRIPTION =
  "Preview three AI hairstyle directions from one photo before your next haircut. Your first complete preview is free after sign-in.";
export const SITE_UPDATED_AT = new Date("2026-07-17T00:00:00.000Z");

export function absoluteUrl(path = "/") {
  return new URL(path, `${SITE_URL}/`).toString();
}
