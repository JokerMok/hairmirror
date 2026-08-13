export const SITE_NAME = "HairMirror";
export const SITE_URL = (
  process.env.PUBLIC_APP_URL || "https://web-production-eeda8.up.railway.app"
).replace(/\/$/, "");
export const SITE_DESCRIPTION =
  "AI hairstyle consultation for customers and stylists: compare three practical directions and leave with a shareable consultation card.";
export const SITE_UPDATED_AT = new Date("2026-08-13T00:00:00.000Z");

export function absoluteUrl(path = "/") {
  return new URL(path, `${SITE_URL}/`).toString();
}
