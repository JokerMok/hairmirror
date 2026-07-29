import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms for HairMirror accounts, AI hairstyle previews, personal packs, salon subscriptions, cancellation, and acceptable use.",
  alternates: { canonical: "/terms" },
};

export default async function TermsPage() {
  const zh =
    normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value) === "zh-CN";
  const sections = zh
    ? [
        {
          t: "1. 服务内容",
          b: "发型镜提供 AI 发型预览和设计参考。生成结果不构成理发、医疗或专业建议，也不保证实际剪发效果。",
        },
        {
          t: "2. 账号与使用",
          b: "你应提供真实、合法的账号信息，并妥善保管登录凭据。不得上传未获授权的照片，不得绕过额度、费用或安全限制。",
        },
        {
          t: "3. 订阅与续费",
          b: "订阅通过 Paddle 以美元结算并自动续费。最终价格、账单周期和适用税费以 Paddle 结账页为准。你可以通过 Paddle 客户门户管理付款方式、账单和取消续费。",
        },
        {
          t: "4. 退款与取消",
          b: "取消订阅后，权益通常持续到当前已付费周期结束。法律另有要求或产品页面另有承诺的除外，已开始的订阅周期不按未使用额度自动折算退款。",
        },
        {
          t: "5. 可接受使用",
          b: "禁止利用本服务侵犯隐私、冒充他人、实施欺诈、生成违法内容或干扰系统运行。违反规则时，我们可以暂停账号并保留必要的审计记录。",
        },
      ]
    : [
        {
          t: "1. Service",
          b: "HairMirror provides AI hairstyle previews for design reference. Results are not professional, medical, or barbering advice and do not guarantee an identical real-world haircut.",
        },
        {
          t: "2. Accounts and use",
          b: "Provide accurate account information and protect your credentials. Do not upload photos without permission or bypass usage, billing, or security controls.",
        },
        {
          t: "3. Subscriptions",
          b: "Subscriptions are billed in USD through Paddle and renew automatically. Paddle Checkout is the source of truth for final price, billing interval, and applicable tax. Use the Paddle customer portal to manage payment methods, invoices, and cancellation.",
        },
        {
          t: "4. Cancellation and refunds",
          b: "After cancellation, access normally continues through the paid billing period. Unless required by law or expressly offered, unused generation allowance does not automatically create a prorated refund.",
        },
        {
          t: "5. Acceptable use",
          b: "Do not use the service to violate privacy, impersonate others, commit fraud, create unlawful material, or disrupt the platform. We may suspend accounts that violate these terms while retaining necessary audit records.",
        },
      ];
  return (
    <main className="min-h-screen overflow-x-clip">
      <article className="page-container max-w-3xl py-14 md:py-20">
        <p className="text-sm text-[#6f7773]">
          {zh ? "生效日期：2026 年 7 月 15 日" : "Effective July 15, 2026"}
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-.04em] md:text-5xl">
          {zh ? "发型镜服务条款" : "HairMirror Terms of Service"}
        </h1>
        <div className="mt-10 divide-y divide-[var(--line)] border-y border-[var(--line)]">
          {sections.map((x) => (
            <section key={x.t} className="py-7 md:grid md:grid-cols-[210px_1fr] md:gap-8">
              <h2 className="font-semibold">{x.t}</h2>
              <p className="mt-2 text-sm leading-7 text-[#56615d]">{x.b}</p>
            </section>
          ))}
        </div>
        <Link
          href="/"
          className="button-primary mt-8"
        >
          {zh ? "返回发型镜" : "Back to HairMirror"}
        </Link>
      </article>
    </main>
  );
}
