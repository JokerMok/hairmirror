"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useSyncExternalStore } from "react";
import { ArrowLeft, Check, Scissors, ShieldCheck } from "lucide-react";
import { LocaleSwitcher } from "@/components/locale-switcher";
import type { Locale } from "@/lib/i18n";

export default function LoginPage() {
  const router = useRouter();
  const locale = useSyncExternalStore(
    () => () => {},
    () => (document.cookie.includes("hair_locale=zh-CN") ? "zh-CN" : "en"),
    () => "en",
  ) as Locale;
  const requestedNext = useSyncExternalStore(
    () => () => {},
    () => window.location.search,
    () => "",
  );
  const zh = locale === "zh-CN";
  const t = (en: string, cn: string) => (zh ? cn : en);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [accountTypeOverride, setAccountTypeOverride] = useState<"personal" | "store_owner" | null>(null);
  const stylistEntry = new URLSearchParams(requestedNext).get("next")?.startsWith("/salon/consultations") ?? false;
  const accountType = accountTypeOverride ?? (stylistEntry ? "store_owner" : "personal");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form);
    const response = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok) {
      const requested = new URLSearchParams(window.location.search).get("next");
      const destination =
        requested?.startsWith("/") && !requested.startsWith("//")
          ? requested
          : "/account";
      router.push(destination);
      router.refresh();
      return;
    }
    const data = await response.json().catch(() => ({}));
    setError(
      data.error === "EMAIL_EXISTS"
        ? t("This email is already registered.", "该邮箱已注册")
        : data.error === "INVALID_CREDENTIALS"
          ? t("Email or password is incorrect.", "邮箱或密码不正确")
          : t("Please check the information you entered.", "请检查填写内容"),
    );
    setLoading(false);
  }
  return (
    <main className="min-h-screen overflow-x-clip">
      <div className="page-container py-6">
        <header className="flex min-h-14 items-center justify-between">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--brand)]"
          >
            <ArrowLeft size={16} />
            {t("Back to HairMirror", "返回发型镜")}
          </Link>
          <LocaleSwitcher locale={locale} />
        </header>
        <div className="mx-auto mt-8 grid max-w-5xl overflow-hidden rounded-[2rem] border border-[var(--line)] bg-white shadow-[var(--shadow-md)] lg:grid-cols-[1.05fr_.95fr]">
          <aside className="relative hidden min-h-[720px] overflow-hidden bg-[var(--surface-dark)] text-white lg:block">
            <Image src="/showcase/curly-youth.jpg" alt="Curly hairstyle inspiration" fill unoptimized priority sizes="(min-width: 1024px) 520px, 1px" className="object-cover opacity-55" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#102b25] via-[#102b25]/45 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-10">
              <p className="eyebrow !text-[#b9dfd3]">HairMirror</p>
              <h2 className="mt-4 max-w-md text-4xl font-semibold tracking-[-.045em]">{t("Make the decision before the haircut.", "剪发之前，先把方向想清楚。")}</h2>
              <ul className="mt-8 grid gap-3 text-sm text-white/80">
                <li className="flex items-center gap-2"><Check size={17} />{t("Three directions to compare", "三种方向同时比较")}</li>
                <li className="flex items-center gap-2"><ShieldCheck size={17} />{t("Private by default", "默认保护照片隐私")}</li>
              </ul>
            </div>
          </aside>
          <section className="p-7 md:p-11 lg:p-12">
          <div className="brand-mark">
            <Scissors size={19} />
          </div>
          <h1 className="mt-6 text-3xl font-semibold">
            {mode === "login"
              ? t("Sign in", "登录发型镜")
              : t("Create account", "创建账号")}
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
            {mode === "login"
              ? t(
                  "Access your hairstyle history and consultation cards.",
                  "查看你的发型记录和沟通卡。",
                )
              : t(
                  "Register with your email and start a consultation during the free pilot.",
                  "使用邮箱注册，在免费试用阶段开始一次咨询。",
                )}
          </p>
          <form onSubmit={submit} className="mt-7 grid gap-4">
            {mode === "register" && (
              <>
                <label className="text-sm">
                  {t("Name", "称呼")}
                  <input
                    name="name"
                    required
                    minLength={2}
                    maxLength={30}
                    autoComplete="name"
                    className="mt-2 w-full rounded-xl border border-[#cfd7d2] bg-white px-4 py-3"
                  />
                </label>
                <fieldset>
                  <legend className="text-sm">
                    {t("Account type", "账号类型")}
                  </legend>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAccountTypeOverride("personal")}
                    className={`min-h-12 rounded-xl border px-3 py-3 text-sm ${accountType === "personal" ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]" : "border-[var(--line)] hover:border-[#aeb9b4]"}`}
                    >
                      {t("Personal", "个人用户")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccountTypeOverride("store_owner")}
                      className={`min-h-12 rounded-xl border px-3 py-3 text-sm ${accountType === "store_owner" ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]" : "border-[var(--line)] hover:border-[#aeb9b4]"}`}
                    >
                      {t("Salon owner", "门店管理员")}
                    </button>
                  </div>
                  <input type="hidden" name="accountType" value={accountType} />
                </fieldset>
                {accountType === "store_owner" && (
                  <label className="text-sm">
                    {t("Salon name", "门店名称")}
                    <input
                      name="storeName"
                      required
                      minLength={2}
                      maxLength={50}
                      className="mt-2 w-full rounded-xl border border-[#cfd7d2] bg-white px-4 py-3"
                    />
                  </label>
                )}
              </>
            )}
            <label className="text-sm">
              {t("Email", "邮箱")}
              <input
                name={mode === "login" ? "identifier" : "email"}
                required
                type="email"
                autoComplete="email"
                className="mt-2 w-full rounded-xl border border-[#cfd7d2] bg-white px-4 py-3"
                placeholder="you@example.com"
              />
            </label>
            <label className="text-sm">
              {t("Password", "密码")}
              <input
                name="password"
                required
                type="password"
                minLength={8}
                maxLength={72}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                className="mt-2 w-full rounded-xl border border-[#cfd7d2] bg-white px-4 py-3"
                placeholder={t("At least 8 characters", "至少8位")}
              />
            </label>
            {mode === "login" && (
              <Link
                href="/forgot-password"
                className="-mt-2 min-h-11 inline-flex items-center text-sm text-[var(--brand)] underline underline-offset-4"
              >
                {t("Forgot your password?", "忘记密码？")}
              </Link>
            )}
            {error && (
              <p
                role="alert"
                className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}
            <button
              disabled={loading}
              className="button-primary mt-2 w-full disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? t("Please wait…", "请稍候…")
                : mode === "login"
                  ? t("Sign in", "登录")
                  : t("Create account", "注册并登录")}
            </button>
          </form>
          <button
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
            className="min-h-11 mt-4 w-full text-sm font-medium text-[var(--brand)] hover:text-[var(--brand-hover)]"
          >
            {mode === "login"
              ? t("New here? Create an account", "还没有账号？立即注册")
              : t("Already have an account? Sign in", "已有账号？返回登录")}
          </button>
          </section>
        </div>
      </div>
    </main>
  );
}
