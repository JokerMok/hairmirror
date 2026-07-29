"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import type { Locale } from "@/lib/i18n";

export type HairMirrorRole = "consumer" | "stylist";
export const ROLE_STORAGE_KEY = "hairmirror.role";
const ROLE_EVENT = "hairmirror-role-change";

export function rolePath(role: HairMirrorRole) {
  return role === "stylist" ? "/salon" : "/consumer";
}

function readStoredRole(): HairMirrorRole | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(ROLE_STORAGE_KEY);
    return value === "consumer" || value === "stylist" ? value : null;
  } catch {
    return null;
  }
}

function subscribeToRole(onChange: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("storage", onChange);
  window.addEventListener(ROLE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(ROLE_EVENT, onChange);
  };
}

export function RoleEntry({ locale }: { locale: Locale }) {
  const zh = locale === "zh-CN";
  const t = (en: string, cn: string) => (zh ? cn : en);
  const selectedRole = useSyncExternalStore(subscribeToRole, readStoredRole, () => null);

  function chooseRole(role: HairMirrorRole) {
    try {
      window.localStorage.setItem(ROLE_STORAGE_KEY, role);
    } catch {
      // Private browsing and storage-restricted contexts still allow navigation.
    }
    window.dispatchEvent(new Event(ROLE_EVENT));
  }

  const roles: Array<{
    id: HairMirrorRole;
    label: string;
    description: string;
    action: string;
  }> = [
    {
      id: "consumer",
      label: t("I’m a customer", "我是客户"),
      description: t(
        "Explore a direction before your next appointment.",
        "在下一次预约前，先找到适合自己的方向。",
      ),
      action: t("Continue as customer", "以客户身份继续"),
    },
    {
      id: "stylist",
      label: t("I’m a stylist", "我是发型师"),
      description: t(
        "Turn a vague request into a consultation plan.",
        "把模糊需求整理成可执行的咨询方案。",
      ),
      action: t("Continue as stylist", "以发型师身份继续"),
    },
  ];

  return (
    <section className="border-b border-[var(--line)] bg-[#f5f7f3] py-8 md:py-10">
      <div className="page-container">
        <div className="mx-auto max-w-4xl">
          <p className="eyebrow">{t("AI HAIR CONSULTATION", "AI 发型咨询")}</p>
          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="max-w-2xl text-2xl font-semibold tracking-[-.035em] text-[var(--text)] md:text-3xl">
                {t("Start with the decision, not the haircut.", "先把发型方向想清楚，再走进理发店。")}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
                {t(
                  "Choose the path that fits how you are using HairMirror.",
                  "选择最符合你使用方式的入口。",
                )}
              </p>
            </div>
            <Link href="/#studio" className="button-secondary min-h-11 shrink-0 self-start md:self-end">
              {t("Open the preview", "直接开始预览")}
            </Link>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-2" role="radiogroup" aria-label={t("Choose your role", "选择你的身份")}>
            {roles.map((role) => {
              const selected = selectedRole === role.id;
              return (
                <div
                  key={role.id}
                  className={`rounded-2xl border bg-white p-4 transition ${selected ? "border-[var(--brand)] ring-2 ring-[var(--brand)]/15" : "border-[var(--line)] hover:border-[#aeb9b4]"}`}
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => chooseRole(role.id)}
                    className="flex min-h-20 w-full items-start gap-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
                  >
                    <span aria-hidden className={`mt-1 flex size-4 shrink-0 items-center justify-center rounded-full border ${selected ? "border-[var(--brand)] bg-[var(--brand)]" : "border-[#aeb9b4]"}`}>
                      {selected && <span className="size-1.5 rounded-full bg-white" />}
                    </span>
                    <span>
                      <span className="block text-base font-semibold text-[var(--text)]">{role.label}</span>
                      <span className="mt-1 block text-sm leading-5 text-[var(--text-muted)]">{role.description}</span>
                    </span>
                  </button>
                  <Link
                    href={rolePath(role.id)}
                    onClick={() => chooseRole(role.id)}
                    className={`mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-full px-4 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] ${selected ? "bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)]" : "border border-[var(--line)] bg-white text-[var(--text)] hover:border-[#aeb9b4]"}`}
                  >
                    {role.action}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
