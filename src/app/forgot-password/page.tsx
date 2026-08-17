"use client";

import Link from "next/link";
import { FormEvent, useState, useSyncExternalStore } from "react";
import { ArrowLeft, Mail, Scissors } from "lucide-react";
import { LocaleSwitcher } from "@/components/locale-switcher";
import type { Locale } from "@/lib/i18n";

export default function ForgotPasswordPage() {
  const locale = useSyncExternalStore(
    () => () => {},
    () => (document.cookie.includes("hair_locale=zh-CN") ? "zh-CN" : "en"),
    () => "en",
  ) as Locale;
  const zh = locale === "zh-CN";
  const t = (en: string, cn: string) => (zh ? cn : en);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setState(response.ok ? "sent" : "error");
  }

  return (
    <main className="min-h-screen overflow-x-clip">
      <div className="page-container max-w-xl py-6">
        <header className="flex min-h-14 items-center justify-between">
          <Link href="/login" className="inline-flex min-h-11 items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--brand)]">
            <ArrowLeft size={16} />
            {t("Back to sign in", "返回登录")}
          </Link>
          <LocaleSwitcher locale={locale} />
        </header>
        <section className="mt-16 rounded-[2rem] border border-[var(--line)] bg-white p-7 shadow-[var(--shadow-md)] md:p-11">
          <div className="brand-mark"><Scissors size={19} /></div>
          <h1 className="mt-6 text-3xl font-semibold">{t("Reset your password", "重置密码")}</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
            {t("Enter the email on your HairMirror account and we will send a one-time reset link.", "输入 HairMirror 账号邮箱，我们会发送一次性密码重置链接。")}
          </p>
          {state === "sent" ? (
            <p role="status" className="mt-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900">
              {t("If that account exists, a reset link is on its way. The link expires in 30 minutes.", "如果该账号存在，重置链接已经发送。链接将在 30 分钟后失效。")}
            </p>
          ) : (
            <form onSubmit={submit} className="mt-7 grid gap-4">
              <label className="text-sm">
                {t("Email", "邮箱")}
                <span className="relative mt-2 block">
                  <Mail size={17} className="pointer-events-none absolute left-4 top-4 text-[#7b8781]" />
                  <input value={email} onChange={(event) => setEmail(event.target.value)} required type="email" autoComplete="email" className="w-full rounded-xl border border-[#cfd7d2] bg-white py-3 pl-11 pr-4" placeholder="you@example.com" />
                </span>
              </label>
              {state === "error" && (
                <p role="alert" className="rounded-xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                  {t("Password reset email is not configured yet. Please contact the published support address.", "密码重置邮件尚未配置，请联系页面公布的支持邮箱。")}
                </p>
              )}
              <button disabled={state === "sending"} className="button-primary mt-2 w-full disabled:cursor-not-allowed disabled:opacity-60">
                {state === "sending" ? t("Sending…", "发送中…") : t("Send reset link", "发送重置链接")}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
