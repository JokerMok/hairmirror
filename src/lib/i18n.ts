export type Locale = "en" | "zh-CN";
export const LOCALE_COOKIE = "hair_locale";
export function normalizeLocale(value: string | undefined | null): Locale {
  return value === "zh-CN" ? "zh-CN" : "en";
}
export function localeName(locale: Locale) {
  return locale === "en" ? "English" : "中文";
}
