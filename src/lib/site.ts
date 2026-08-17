export const SITE_NAME = "HairMirror";
export const SITE_URL = (
  process.env.PUBLIC_APP_URL || "https://hairmirror-v03.lopezerendira678.chatgpt.site"
).replace(/\/$/, "");
export const SITE_DESCRIPTION =
  "HairMirror helps customers and stylists compare three practical hairstyle directions before the haircut.";
export const SITE_DESCRIPTION_ZH =
  "发型镜帮助客户和发型师在剪发前比较三种实际可行的发型方向。";
export const SITE_UPDATED_AT = new Date("2026-08-13T00:00:00.000Z");

export function absoluteUrl(path = "/") {
  return new URL(path, `${SITE_URL}/`).toString();
}
