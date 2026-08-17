export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || null;

export function supportMailto(subject: string) {
  if (!SUPPORT_EMAIL) return null;
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}
