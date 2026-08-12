import Link from "next/link";
import { ArrowLeft, ArrowRight, UserRound } from "lucide-react";
import { cookies } from "next/headers";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { AUTH_COOKIE, getUserByToken } from "@/lib/auth";
import { LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n";

export default async function ConsumerPage() {
  const jar = await cookies();
  const locale = normalizeLocale(jar.get(LOCALE_COOKIE)?.value);
  const user = getUserByToken(jar.get(AUTH_COOKIE)?.value);
  const zh = locale === "zh-CN";
  const t = (en: string, cn: string) => (zh ? cn : en);
  const startHref = user ? "/consumer/consultations/new" : "/login?next=%2Fconsumer%2Fconsultations%2Fnew";

  return (
    <main className="min-h-screen overflow-x-clip">
      <div className="page-container max-w-5xl py-6 md:py-8">
        <header className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-5">
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--brand)]">
            <ArrowLeft size={16} /> {t("Back to HairMirror", "返回发型镜")}
          </Link>
          <div className="flex items-center gap-3">
            <LocaleSwitcher locale={locale} />
            <Link href={user ? "/account" : "/login?next=%2Fconsumer"} className="button-secondary min-h-11">
              {user ? t("Account", "我的") : t("Sign in", "登录")}
            </Link>
          </div>
        </header>
        <section className="mt-10 rounded-[2rem] border border-[var(--line)] bg-white p-7 shadow-[var(--shadow-sm)] md:mt-14 md:p-12">
          <div className="brand-mark"><UserRound size={19} /></div>
          <p className="eyebrow mt-6">{t("CONSUMER CONSULTATION", "客户咨询")}</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-[-.045em] text-[var(--text)] md:text-5xl">
            {t("Find your next style with confidence.", "更有把握地找到下一款发型。")}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--text-muted)]">
            {t("Upload a clear photo and compare practical directions before your next haircut. HairMirror turns your preferences into a simple conversation card for your stylist.", "上传一张清晰照片，在下一次剪发前比较适合日常的发型方向。发型镜会把你的偏好整理成一张便于和发型师沟通的卡片。")}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={startHref} className="button-primary min-h-11">
              {t("Start a consultation", "开始咨询")} <ArrowRight size={16} />
            </Link>
            <Link href="/#examples" className="button-secondary min-h-11">
              {t("See comparison cases", "查看案例")}
            </Link>
          </div>
          <div className="mt-10 grid gap-3 border-t border-[var(--line)] pt-7 text-sm text-[var(--text-muted)] md:grid-cols-3">
            <span>{t("Clear recommendations", "清晰的推荐方向")}</span>
            <span>{t("Upkeep notes you can use", "可执行的打理建议")}</span>
            <span>{t("A card to show your stylist", "可直接给发型师看的沟通卡")}</span>
          </div>
        </section>
      </div>
    </main>
  );
}
