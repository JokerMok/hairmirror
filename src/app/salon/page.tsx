import Link from "next/link";
import { ArrowLeft, ArrowRight, Scissors } from "lucide-react";
import { cookies } from "next/headers";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { AUTH_COOKIE, getUserByToken } from "@/lib/auth";
import { LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n";

export default async function SalonPage() {
  const jar = await cookies();
  const locale = normalizeLocale(jar.get(LOCALE_COOKIE)?.value);
  const user = getUserByToken(jar.get(AUTH_COOKIE)?.value);
  const zh = locale === "zh-CN";
  const t = (en: string, cn: string) => (zh ? cn : en);
  const startHref = user ? "/#studio" : "/login?next=%2F%23studio";

  return (
    <main className="min-h-screen overflow-x-clip">
      <div className="page-container max-w-5xl py-6 md:py-8">
        <header className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-5">
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--brand)]">
            <ArrowLeft size={16} /> {t("Back to HairMirror", "返回发型镜")}
          </Link>
          <div className="flex items-center gap-3">
            <LocaleSwitcher locale={locale} />
            <Link href={user ? "/account" : "/login?next=%2Fsalon"} className="button-secondary min-h-11">
              {user ? t("Account", "我的") : t("Sign in", "登录")}
            </Link>
          </div>
        </header>
        <section className="mt-10 rounded-[2rem] border border-[var(--line)] bg-[var(--surface-dark)] p-7 text-white shadow-[var(--shadow-sm)] md:mt-14 md:p-12">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-[#e9b663] text-[#15342d]"><Scissors size={19} /></div>
          <p className="eyebrow mt-6 !text-[#b9dfd3]">{t("STYLIST WORKSPACE", "发型师工作台")}</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-[-.045em] md:text-5xl">
            {t("Turn vague requests into a clear plan.", "把模糊需求整理成清晰的执行方案。")}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/70">
            {t("Create a lightweight consultation for a client, compare three directions, and leave with instructions your team can act on.", "为客户创建一份轻量咨询，比较三种发型方向，并留下团队可以执行的建议。")}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={startHref} className="button-primary min-h-11 bg-[#e9b663] !text-[#15342d] hover:bg-[#f2c77e]">
              {t("Create a consultation", "创建客户咨询")} <ArrowRight size={16} />
            </Link>
            <Link href="/#examples" className="button-secondary min-h-11 border-white/20 bg-white/10 !text-white hover:bg-white/15">
              {t("View examples", "查看案例")}
            </Link>
          </div>
          <div className="mt-10 grid gap-3 border-t border-white/15 pt-7 text-sm text-white/65 md:grid-cols-3">
            <span>{t("Client-ready recommendations", "客户可理解的推荐")}</span>
            <span>{t("Practical upkeep notes", "可落地的打理建议")}</span>
            <span>{t("A shareable consultation card", "可分享的咨询沟通卡")}</span>
          </div>
        </section>
      </div>
    </main>
  );
}
