import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n";
import { SupportContact } from "@/components/support-contact";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: "HairMirror's current free-pilot policy. No payment is required during workflow validation.",
  alternates: { canonical: "/refunds" },
};

export default async function RefundPolicyPage() {
  const zh =
    normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value) === "zh-CN";
  const sections = zh
    ? [
        { t: "当前阶段", b: "HairMirror 当前处于免费试用与工作流验证阶段，不要求付款，也没有启用中的个人次数包或门店订阅，因此目前不存在需要申请的付费退款。" },
        { t: "未来付费服务", b: "如果未来启用付费服务，我们会在付款前公布价格、服务范围、取消和退款规则，并同步更新服务条款与本政策。" },
        { t: "试用反馈", b: "如果生成失败、照片需要删除或你发现了其他问题，支持邮箱将在邀请外部试用前配置并公布。" },
      ]
    : [
        { t: "Current pilot", b: "HairMirror is currently a free pilot. No payment is required and no personal pack or salon subscription is active, so there are no paid refunds to request during this phase." },
        { t: "Future paid services", b: "If paid services launch, we will publish the price, scope, cancellation, and refund rules before checkout and update the Terms of Service and this policy." },
        { t: "Pilot support", b: "If a generation fails, you want a source photo deleted, or you find another issue, a support email will be configured and published before external pilot invitations." },
      ];

  return (
    <main className="min-h-screen overflow-x-clip">
      <article className="page-container max-w-3xl py-14 md:py-20">
        <p className="text-sm text-[#6f7773]">
          {zh ? "生效日期：2026 年 7 月 27 日" : "Effective July 27, 2026"}
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-.04em] md:text-5xl">
          {zh ? "发型镜退款政策" : "HairMirror Refund Policy"}
        </h1>
        <div className="mt-10 divide-y divide-[var(--line)] border-y border-[var(--line)]">
          {sections.map((section) => (
            <section
              key={section.t}
              className="py-7 md:grid md:grid-cols-[210px_1fr] md:gap-8"
            >
              <h2 className="font-semibold">{section.t}</h2>
              <p className="mt-2 text-sm leading-7 text-[#56615d]">{section.b}</p>
            </section>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/" className="button-primary">
            {zh ? "返回发型镜" : "Back to HairMirror"}
          </Link>
          <Link href="/terms" className="button-secondary">
            {zh ? "查看服务条款" : "View Terms of Service"}
          </Link>
        </div>
        <p className="mt-8 text-sm leading-6 text-[#56615d]">
          {zh ? "试用反馈和删除请求：" : "Pilot feedback and deletion requests: "}
          <SupportContact locale={zh ? "zh-CN" : "en"} subject={zh ? "发型镜试用支持请求" : "HairMirror pilot support request"} />
        </p>
      </article>
    </main>
  );
}
