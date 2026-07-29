import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: "HairMirror refund and cancellation policy for preview packs and salon subscriptions.",
  alternates: { canonical: "/refunds" },
};

export default async function RefundPolicyPage() {
  const zh =
    normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value) === "zh-CN";
  const sections = zh
    ? [
        {
          t: "个人体验包",
          b: "若付款重复、服务未交付或法律要求退款，可提出退款申请。已成功生成的体验次数通常不予退款；生成任务失败时，系统会自动返还对应次数。",
        },
        {
          t: "门店订阅",
          b: "取消订阅会停止后续续费，已付费权益通常持续到当前账单周期结束。除非法律要求、重复扣款或服务未交付，已开始的账单周期通常不按未使用额度折算退款。",
        },
        {
          t: "申请与处理",
          b: "请通过 Paddle 收据或客户账单门户中的支持入口提交订单邮箱、交易编号和退款原因。获准的退款将由 Paddle 原路退回，到账时间取决于支付方式和金融机构。",
        },
      ]
    : [
        {
          t: "Personal preview packs",
          b: "You may request a refund for a duplicate charge, failure to deliver the service, or where required by law. Completed preview sessions are generally non-refundable. Credits are automatically restored when a generation job fails.",
        },
        {
          t: "Salon subscriptions",
          b: "Cancellation stops future renewals, while paid access normally continues through the current billing period. Started billing periods are generally non-refundable except where required by law, charged in duplicate, or not delivered.",
        },
        {
          t: "Requests and processing",
          b: "Use the support option on your Paddle receipt or customer billing portal and include the purchase email, transaction ID, and reason for the request. Approved refunds are returned by Paddle to the original payment method; timing depends on the payment provider.",
        },
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
      </article>
    </main>
  );
}
