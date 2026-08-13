import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowRight, Scissors } from "lucide-react";
import { cookies } from "next/headers";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { AUTH_COOKIE, getUserByToken } from "@/lib/auth";
import { salonStartPath } from "@/lib/entry-routes";
import { LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n";

export default async function SalonPage() {
  const jar = await cookies();
  const locale = normalizeLocale(jar.get(LOCALE_COOKIE)?.value);
  const user = getUserByToken(jar.get(AUTH_COOKIE)?.value);
  const zh = locale === "zh-CN";
  const t = (en: string, cn: string) => (zh ? cn : en);
  const startHref = salonStartPath(user?.role ?? null);
  const startLabel = user?.role === "personal"
    ? t("Continue as customer", "以客户身份继续")
    : t("Create a consultation", "创建客户咨询");
  const workflow = zh
    ? [
        ["01", "客户照片与要求", "上传正面照片，记录想变长短、打理时间和接受烫染程度。"],
        ["02", "三种方向", "系统把模糊描述整理成三种可比较的发型轮廓。"],
        ["03", "一起筛选", "发型师和客户并排查看，保存最接近实际条件的一种。"],
        ["04", "执行要点", "确认长度、层次、刘海和日常打理要求。"],
        ["05", "沟通卡", "把选中的方向和注意事项发给客户或交给团队执行。"],
      ]
    : [
        ["01", "Client photo and brief", "Upload a front-facing photo and capture length, styling time, and treatment constraints."],
        ["02", "Three directions", "Turn a vague request into three silhouettes that are easy to compare."],
        ["03", "Decide together", "Review the options with the client and save the direction that fits real conditions."],
        ["04", "Execution notes", "Confirm length, layers, fringe, and the upkeep the client will actually do."],
        ["05", "Communication card", "Send the selected direction and practical notes to the client or the team."],
      ];

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
            <Link href={startHref} className="button-primary min-h-11 bg-[#e9b663] !text-[#102b25] hover:bg-[#f2c77e]">
              {startLabel} <ArrowRight size={16} />
            </Link>
            <Link href="/#examples" className="button-secondary min-h-11 border-white bg-white !text-[#173b33] hover:bg-[#f4f8f5]">
              {t("View examples", "查看案例")}
            </Link>
          </div>
          <div className="mt-10 grid gap-3 border-t border-white/15 pt-7 text-sm text-white/65 md:grid-cols-3">
            <span>{t("Client-ready recommendations", "客户可理解的推荐")}</span>
            <span>{t("Practical upkeep notes", "可落地的打理建议")}</span>
            <span>{t("A shareable consultation card", "可分享的咨询沟通卡")}</span>
          </div>
        </section>

        <section className="mt-8 rounded-[2rem] border border-[var(--line)] bg-white p-6 shadow-[var(--shadow-sm)] md:mt-10 md:p-10" aria-labelledby="workflow-title">
          <div className="max-w-2xl">
            <p className="eyebrow">{t("ONE CONSULTATION", "一次咨询")}</p>
            <h2 id="workflow-title" className="mt-3 text-3xl font-semibold tracking-[-.04em] md:text-4xl">
              {t("From a vague request to a card the client can take home.", "从模糊需求，到客户可以带走的沟通卡。")}
            </h2>
            <p className="mt-4 leading-7 text-[var(--text-muted)]">
              {t("This is the intended salon workflow—not just a before-and-after image.", "这里展示的是完整的门店咨询流程，而不只是前后对比图。")}
            </p>
          </div>
          <div className="mt-8 grid gap-3 md:grid-cols-5">
            {workflow.map(([number, title, description]) => (
              <article key={number} className="rounded-2xl bg-[#f5f7f3] p-4">
                <span className="text-xs font-bold tracking-[.14em] text-[var(--brand)]">{number}</span>
                <h3 className="mt-5 text-sm font-semibold leading-5">{title}</h3>
                <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{description}</p>
              </article>
            ))}
          </div>

          <article className="mt-6 grid overflow-hidden rounded-3xl border border-[var(--line)] bg-[#f8faf7] lg:grid-cols-[.8fr_1.2fr]">
            <div className="grid gap-3 p-5 sm:grid-cols-[140px_1fr] lg:grid-cols-1 lg:p-6">
              <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-[#e2e9e4]">
                <Image src="/showcase/sources/man-02.jpg" alt={t("Example client source photo", "示例客户原始照片")} fill unoptimized sizes="(max-width: 640px) 34vw, 140px" className="object-cover object-center" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[.14em] text-[var(--brand)]">{t("Example client brief", "示例客户需求")}</p>
                <p className="mt-3 text-sm leading-6 text-[#33433d]">{t("Keep the length around the collar, look more relaxed, and stay within ten minutes of daily styling.", "希望保留到锁骨附近，整体更松弛，每天打理控制在十分钟内。")}</p>
              </div>
            </div>
            <div className="border-t border-[var(--line)] p-5 lg:border-l lg:border-t-0 lg:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[.14em] text-[var(--brand)]">{t("Selected direction", "已选方向")}</p>
                  <h3 className="mt-2 text-xl font-semibold">{t("Collar layers", "锁骨层次")}</h3>
                </div>
                <span className="rounded-full bg-[#e4f0ec] px-3 py-1.5 text-xs font-semibold text-[var(--brand)]">{t("Ready to discuss", "可进入沟通")}</span>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2">
                {["style-01.jpg", "style-02.jpg", "style-03.jpg"].map((file, index) => (
                  <div key={file} className={`relative aspect-[4/5] overflow-hidden rounded-xl ${index === 2 ? "ring-2 ring-[var(--brand)] ring-offset-2" : ""}`}>
                    <Image src={`/showcase/cases/case-03/${file}`} alt={t(`Option ${index + 1}`, `方案 ${index + 1}`)} fill unoptimized sizes="(max-width: 1024px) 30vw, 180px" className="object-cover object-center" />
                  </div>
                ))}
              </div>
              <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-xl bg-white p-3"><dt className="text-xs text-[var(--text-muted)]">{t("Cut plan", "剪裁方向")}</dt><dd className="mt-1 font-medium">{t("Collar length · soft layers", "锁骨长度 · 柔和层次")}</dd></div>
                <div className="rounded-xl bg-white p-3"><dt className="text-xs text-[var(--text-muted)]">{t("Upkeep", "日常打理")}</dt><dd className="mt-1 font-medium">{t("Low · under 10 min", "低 · 十分钟以内")}</dd></div>
              </dl>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
