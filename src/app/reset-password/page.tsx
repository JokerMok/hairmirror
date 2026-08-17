"use client";

import Link from "next/link";
import { FormEvent, useState, useSyncExternalStore } from "react";
import { ArrowLeft, Scissors } from "lucide-react";
import { LocaleSwitcher } from "@/components/locale-switcher";
import type { Locale } from "@/lib/i18n";

export default function ResetPasswordPage() {
  const locale = useSyncExternalStore(
    () => () => {},
    () => (document.cookie.includes("hair_locale=zh-CN") ? "zh-CN" : "en"),
    () => "en",
  ) as Locale;
  const search = useSyncExternalStore(() => () => {}, () => window.location.search, () => "");
  const token = new URLSearchParams(search).get("token") ?? "";
  const zh = locale === "zh-CN";
  const t = (en: string, cn: string) => (zh ? cn : en);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || password !== confirmation) {
      setState("error");
      return;
    }
    setState("saving");
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setState(response.ok ? "saved" : "error");
  }

  return (
    <main className="min-h-screen overflow-x-clip">
      <div className="page-container max-w-xl py-6">
        <header className="flex min-h-14 items-center justify-between">
          <Link href="/login" className="inline-flex min-h-11 items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--brand)]"><ArrowLeft size={16} />{t("Back to sign in", "返回登录")}</Link>
          <LocaleSwitcher locale={locale} />
        </header>
        <section className="mt-16 rounded-[2rem] border border-[var(--line)] bg-white p-7 shadow-[var(--shadow-md)] md:p-11">
          <div className="brand-mark"><Scissors size={19} /></div>
          <h1 className="mt-6 text-3xl font-semibold">{t("Choose a new password", "设置新密码")}</h1>
          {state === "saved" ? (
            <div className="mt-6 grid gap-4">
              <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900">{t("Your password was updated. Sign in again to continue.", "密码已更新，请重新登录后继续。")}</p>
              <Link href="/login" className="button-primary text-center">{t("Sign in", "登录")}</Link>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-7 grid gap-4">
              <label className="text-sm">{t("New password", "新密码")}<input value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} maxLength={72} type="password" autoComplete="new-password" className="mt-2 w-full rounded-xl border border-[#cfd7d2] bg-white px-4 py-3" /></label>
              <label className="text-sm">{t("Confirm new password", "确认新密码")}<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required minLength={8} maxLength={72} type="password" autoComplete="new-password" className="mt-2 w-full rounded-xl border border-[#cfd7d2] bg-white px-4 py-3" /></label>
              {state === "error" && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">{t("This reset link is invalid, expired, or the passwords do not match.", "链接无效、已过期，或两次密码输入不一致。")}</p>}
              <button disabled={state === "saving"} className="button-primary mt-2 w-full disabled:cursor-not-allowed disabled:opacity-60">{state === "saving" ? t("Saving…", "保存中…") : t("Update password", "更新密码")}</button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
