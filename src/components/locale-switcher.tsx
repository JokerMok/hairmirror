"use client";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";

export function LocaleSwitcher({
  locale,
  dark = false,
}: {
  locale: Locale;
  dark?: boolean;
}) {
  const router = useRouter();
  async function change(next: Locale) {
    await fetch("/api/locale", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ locale: next }),
    });
    router.refresh();
  }
  return (
    <label
      className={`inline-flex items-center gap-2 text-xs ${dark ? "text-white/65" : "text-[#6f7773]"}`}
    >
      <span>{locale === "en" ? "Language" : "语言"}</span>
      <select
        aria-label="Language"
        value={locale}
        onChange={(event) => change(event.target.value as Locale)}
        className={`rounded-full border px-3 py-2 ${dark ? "border-white/15 bg-white/10 text-white" : "border-[#cfd7d2] bg-white"}`}
      >
        <option className="text-black" value="en">
          English
        </option>
        <option className="text-black" value="zh-CN">
          中文
        </option>
      </select>
    </label>
  );
}
