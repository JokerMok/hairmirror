import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms for HairMirror accounts, AI hairstyle previews, the free pilot, and acceptable use.",
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
          b: "你应提供真实、合法的账号信息，并妥善保管登录凭据。不得上传未获授权的照片，不得绕过使用范围、生成限制或安全限制。",
        },
        {
          t: "3. 免费试用阶段",
          b: "当前产品处于免费试用与工作流验证阶段，不要求付款，也没有启用中的个人次数包或门店订阅。未来如启用付费服务，我们会在付款前公布价格、服务范围、取消和退款规则。",
        },
        {
          t: "4. 服务变更与取消",
          b: "你可以停止使用服务并删除可删除的咨询记录。试用阶段的功能、开放范围和生成能力可能调整或暂时关闭；如未来启用付费服务，将在付款前另行说明适用的取消和退款规则。",
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
          b: "Provide accurate account information and protect your credentials. Do not upload photos without permission or bypass usage scope, generation limits, or security controls.",
        },
        {
          t: "3. Free pilot",
          b: "HairMirror is currently a free pilot for validating the consultation workflow. No payment is required and no personal pack or salon subscription is active. If paid services launch, we will publish the price, scope, cancellation, and refund terms before asking for payment.",
        },
        {
          t: "4. Changes and stopping use",
          b: "You may stop using the service and delete records that are available for deletion. During the pilot, features, availability, and generation capacity may change or be temporarily paused. Any future paid service will provide its cancellation and refund terms before checkout.",
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
