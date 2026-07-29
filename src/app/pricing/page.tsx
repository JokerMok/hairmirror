import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Check, Scissors } from "lucide-react";
import { AUTH_COOKIE, getUserByToken } from "@/lib/auth";
import {
  BILLING_PLANS,
  billingCatalog,
  billingProvider,
} from "@/lib/billing";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n";
import {
  gumroadPersonalPackCheckoutUrl,
  personalPackSetCount,
} from "@/lib/gumroad-billing";
import { paddlePriceDetails } from "@/lib/paddle-billing";

export const metadata: Metadata = {
  title: "Pricing – Personal Preview Packs and Salon Plans",
  description: "Start with one free AI hairstyle preview. Buy five personal previews for $1.99 USD or choose Salon Pro for $29 USD per month.",
  alternates: { canonical: "/pricing" },
};

export const dynamic = "force-dynamic";
export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; billing_error?: string }>;
}) {
  const jar = await cookies();
  const locale = normalizeLocale(jar.get(LOCALE_COOKIE)?.value);
  const zh = locale === "zh-CN";
  const user = getUserByToken(jar.get(AUTH_COOKIE)?.value);
  const provider = billingProvider();
  let plans: Awaited<ReturnType<typeof billingCatalog>> = [];
  let hasConfiguredPlans = false;
  try {
    plans = await billingCatalog(locale);
    hasConfiguredPlans = plans.length > 0;
    if (user)
      plans = plans.filter((plan) =>
        BILLING_PLANS[plan.key].roles.includes(user.role),
      );
  } catch {
    /* deployment setup is incomplete */
  }
  const query = await searchParams;
  const cancelled = query.checkout === "cancelled";
  const packSets = personalPackSetCount();
  let packPrice = Number(process.env.GUMROAD_PERSONAL_PACK_PRICE_USD) || 1.99;
  let packPriceConfigured = false;
  if (provider === "paddle") {
    try {
      const price = await paddlePriceDetails("personal_pack");
      if (price) {
        packPrice = price.unitAmount / 100;
        packPriceConfigured = true;
      }
    } catch { /* configuration is incomplete */ }
  }
  const packCheckoutUrl = provider === "gumroad" ? gumroadPersonalPackCheckoutUrl() : null;
  if (packCheckoutUrl) packPriceConfigured = true;
  const showPersonalPack = !user || user.role === "personal";
  return (
    <main className="min-h-screen overflow-x-clip">
      <div className="page-container">
        <header className="site-header !w-full">
          <Link href="/" className="brand-lockup">
            <span className="brand-mark">
              <Scissors size={18} />
            </span>
            <span><b>{zh ? "发型镜" : "HairMirror"}</b><small>{zh ? "AI 发型设计" : "AI hairstyle studio"}</small></span>
          </Link>
          <LocaleSwitcher locale={locale} />
        </header>
        <section className="mx-auto max-w-2xl pb-14 pt-20 text-center md:pt-24">
          <p className="eyebrow">
            {zh ? "美元计价" : "PRICED IN USD"}
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-.045em] md:text-6xl">
            {zh ? "个人按次，门店按月" : "Pay per pack or run a salon plan"}
          </h1>
          <p className="mx-auto mt-6 max-w-xl leading-7 text-[var(--text-muted)]">
            {provider === "paddle"
              ? zh
                ? "Paddle 负责安全结账、税费、账单和订阅管理；付款确认后权益会自动到账。"
                : "Paddle handles secure checkout, taxes, invoices, and subscriptions. Access is added automatically after payment."
              : provider === "gumroad"
              ? zh
                ? "价格以美元显示，Gumroad 负责结账、税费、续订和取消订阅。"
                : "Prices are shown in USD. Gumroad handles checkout, taxes, renewals, and cancellation."
              : zh
                ? "价格、账单周期和税费以 Stripe 结账页为准，可随时在客户门户管理或取消订阅。"
                : "Stripe is the source of truth for price, billing interval, and applicable tax. Manage or cancel anytime in the customer portal."}
          </p>
          <p className="mt-4 text-sm font-semibold text-[var(--brand)]">
            {zh
              ? "登录后可免费完成首次完整体验，无需付款。"
              : "Sign in to get your first complete preview free. No payment required."}
          </p>
          {cancelled && (
            <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {zh
                ? "本次结账已取消，没有产生扣款。"
                : "Checkout was cancelled. You were not charged."}
            </p>
          )}
          {query.billing_error && (
            <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {zh ? "结账暂不可用，请稍后重试。" : "Checkout is temporarily unavailable. Please try again later."}
            </p>
          )}
        </section>
        {showPersonalPack || plans.length ? (
          <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-2">
            {showPersonalPack && (
              <article className="relative flex min-h-[460px] flex-col rounded-[1.75rem] border border-[var(--line)] bg-white p-7 shadow-[var(--shadow-sm)] md:p-9">
                <span className="absolute right-6 top-6 rounded-full bg-[var(--brand-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--brand)]">
                  {zh ? "一次购买" : "One-time purchase"}
                </span>
                <h2 className="text-xl font-semibold">
                  {zh ? "个人体验包" : "Personal Preview Pack"}
                </h2>
                <p className="mt-7 border-b border-[var(--line)] pb-7">
                  <b className="text-5xl tracking-[-.05em]">
                    {new Intl.NumberFormat(locale, {
                      style: "currency",
                      currency: "USD",
                      minimumFractionDigits: 2,
                    }).format(packPrice)}
                  </b>
                  <span className="text-sm text-[var(--text-muted)]">
                    {zh ? " / 次数包" : " / pack"}
                  </span>
                </p>
                <ul className="mt-7 grid gap-4 text-sm leading-6">
                  <li className="flex gap-2"><Check size={18} className="text-[#1f6b5c]" />{zh ? `${packSets} 次完整体验` : `${packSets} complete previews`}</li>
                  <li className="flex gap-2"><Check size={18} className="text-[#1f6b5c]" />{zh ? "每次生成三种发型方向" : "Three hairstyle directions per preview"}</li>
                  <li className="flex gap-2"><Check size={18} className="text-[#1f6b5c]" />{zh ? "次数不过期，失败不扣次数" : "Credits do not expire; failed jobs are refunded"}</li>
                </ul>
                <div className="mt-auto pt-8">
                  {provider === "paddle" && packPriceConfigured ? (
                    <form action="/api/billing/checkout" method="post">
                      <input type="hidden" name="purchase" value="personal_pack" />
                      <button className="button-primary w-full">{zh ? "购买个人次数包" : "Buy preview pack"}</button>
                    </form>
                  ) : packCheckoutUrl ? (
                    <a href={packCheckoutUrl} target="_blank" rel="noreferrer" className="button-primary w-full">
                      {zh ? "购买个人次数包" : "Buy preview pack"}
                    </a>
                  ) : (
                    <button disabled className="min-h-12 w-full cursor-not-allowed rounded-full bg-[#aab4b0] px-5 font-medium text-white">
                      {zh ? "个人次数包配置中" : "Preview pack coming soon"}
                    </button>
                  )}
                </div>
              </article>
            )}
            {plans.map((plan) => (
              <article
                key={plan.key}
                className="relative flex min-h-[460px] flex-col rounded-[1.75rem] border border-[var(--brand)] bg-white p-7 shadow-[var(--shadow-sm)] md:p-9"
              >
                <span className="absolute right-6 top-6 rounded-full bg-[var(--brand-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--brand)]">{zh ? "适合门店" : "For salons"}</span>
                <h2 className="text-xl font-semibold">{plan.name}</h2>
                <p className="mt-7 border-b border-[var(--line)] pb-7">
                  <b className="text-5xl tracking-[-.05em]">
                    {plan.unitAmount == null
                      ? zh
                        ? "结账页显示"
                        : "See checkout"
                      : new Intl.NumberFormat(locale, {
                          style: "currency",
                          currency: plan.currency.toUpperCase(),
                          minimumFractionDigits:
                            plan.unitAmount % 100 === 0 ? 0 : 2,
                          maximumFractionDigits: 2,
                        }).format(plan.unitAmount / 100)}
                  </b>
                  <span className="text-sm text-[var(--text-muted)]">
                    {" "}
                    /{" "}
                    {plan.interval === "month"
                      ? zh
                        ? "月"
                        : "month"
                      : plan.interval === "year"
                        ? zh
                          ? "年"
                          : "year"
                        : zh
                          ? "周期"
                          : "period"}
                  </span>
                </p>
                <ul className="mt-7 grid gap-4 text-sm leading-6">
                  <li className="flex gap-2">
                    <Check size={18} className="text-[#1f6b5c]" />
                    {zh
                      ? `每月 ${Math.floor(plan.quota / 3)} 次完整体验，门店共享`
                      : `${Math.floor(plan.quota / 3)} shared salon previews per month`}
                  </li>
                  <li className="flex gap-2">
                    <Check size={18} className="text-[#1f6b5c]" />
                    {zh
                      ? "三方案对比和历史记录"
                      : "Three-style comparisons and saved history"}
                  </li>
                  <li className="flex gap-2">
                    <Check size={18} className="text-[#1f6b5c]" />
                    {provider === "paddle"
                      ? zh
                        ? "Paddle 安全结账、自动开通与自助账单管理"
                        : "Secure Paddle checkout, automatic access, and self-service billing"
                      : provider === "gumroad"
                      ? zh
                        ? "Gumroad 安全结账和自助订阅管理"
                        : "Secure Gumroad checkout and subscription management"
                      : zh
                        ? "Stripe 安全结账和自助账单管理"
                        : "Secure Stripe Checkout and self-service billing"}
                  </li>
                </ul>
                <div className="mt-auto pt-8">{plan.provider === "gumroad" ? (
                  plan.checkoutUrl ? (
                    <a
                      href={plan.checkoutUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="button-primary w-full"
                    >
                      {zh ? "前往 Gumroad 订阅" : "Subscribe on Gumroad"}
                    </a>
                  ) : (
                    <button
                      disabled
                      className="min-h-12 w-full cursor-not-allowed rounded-full bg-[#aab4b0] px-5 font-medium text-white"
                    >
                      {zh ? "购买链接配置中" : "Checkout link pending"}
                    </button>
                  )
                ) : (
                  <form
                    action="/api/billing/checkout"
                    method="post"
                    className="w-full"
                  >
                    <input type="hidden" name="purchase" value={plan.key} />
                    <button className="button-primary w-full">
                      {zh ? "选择此方案" : "Choose plan"}
                    </button>
                  </form>
                )}</div>
              </article>
            ))}
          </div>
        ) : (
          <section className="rounded-3xl bg-white p-8 text-center text-[#6f7773]">
            <h2 className="text-xl font-semibold text-[#20312c]">
              {user?.role === "staff" && hasConfiguredPlans
                ? zh
                  ? "订阅由门店管理员管理"
                  : "Billing is managed by your salon owner"
                : zh
                  ? "订阅暂未开放"
                  : "Billing setup in progress"}
            </h2>
            <p className="mt-3">
              {user?.role === "staff" && hasConfiguredPlans
                ? zh
                  ? "如需调整套餐或额度，请联系门店管理员。"
                  : "Contact your salon owner to change the plan or allowance."
                : zh
                  ? provider === "paddle"
                    ? "Paddle Price ID 配置完成后会在这里显示。"
                    : provider === "gumroad"
                    ? "Gumroad Product ID 配置完成后会在这里显示。"
                    : "Stripe 产品价格配置完成后会在这里显示。"
                  : provider === "paddle"
                    ? "Plans will appear after Paddle Price IDs are configured."
                    : provider === "gumroad"
                    ? "Plans will appear after Gumroad Product IDs are configured."
                    : "Plans will appear after Stripe Price IDs are configured."}
            </p>
          </section>
        )}
        {provider === "gumroad" && user?.role !== "staff" && (
          <p className="mt-8 text-center text-sm text-[#6f7773]">
            {zh ? "已经购买？" : "Already purchased?"}{" "}
            <Link href="/account?activate=1" className="font-medium underline">
              {zh ? "使用 License Key 激活" : "Activate with a license key"}
            </Link>
          </p>
        )}
        <footer className="py-12 text-center text-xs text-[#6f7773]">
          <Link href="/faq" className="underline">
            {zh ? "常见问题" : "FAQ"}
          </Link>
          <span className="mx-3">·</span>
          <Link href="/privacy" className="underline">
            {zh ? "隐私政策" : "Privacy Policy"}
          </Link>
          <span className="mx-3">·</span>
          <Link href="/terms" className="underline">
            {zh ? "服务条款" : "Terms of Service"}
          </Link>
          <span className="mx-3">·</span>
          <Link href="/refunds" className="underline">
            {zh ? "退款政策" : "Refund Policy"}
          </Link>
        </footer>
      </div>
    </main>
  );
}
