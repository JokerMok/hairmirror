import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ArrowRight, Scissors } from "lucide-react";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "HairMirror Free Pilot",
  description:
    "HairMirror is currently validating its AI hairstyle consultation workflow with a free pilot.",
  alternates: { canonical: "/pricing" },
};

export default async function PricingPage() {
  const locale = normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const zh = locale === "zh-CN";
  return (
    <main className="min-h-screen overflow-x-clip">
      <div className="page-container">
        <header className="site-header !w-full">
          <Link href="/" className="brand-lockup">
            <span className="brand-mark"><Scissors size={18} /></span>
            <span><b>{zh ? "发型镜" : "HairMirror"}</b><small>{zh ? "AI 发型设计" : "AI hairstyle studio"}</small></span>
          </Link>
          <LocaleSwitcher locale={locale} />
        </header>
        <section className="mx-auto max-w-3xl pb-14 pt-20 md:pt-28">
          <p className="eyebrow">{zh ? "免费试用阶段" : "FREE PILOT"}</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-.045em] md:text-6xl">
            {zh ? "先验证咨询流程，再考虑收费。" : "We are validating the consultation workflow before turning on billing."}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-[var(--text-muted)]">
            {zh
              ? "HairMirror 当前面向客户和发型师免费开放，用来验证照片、三种发型方向、选择和沟通卡能否真正帮助一次咨询。当前不需要付款，也没有启用中的个人次数包或门店订阅。"
              : "HairMirror is currently free for customers and stylists while we validate whether photos, three hairstyle directions, a saved choice, and a communication card improve a real consultation. No payment is required, and no personal pack or salon subscription is active."}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/#studio" className="button-primary">
              {zh ? "开始一次免费咨询" : "Start a free consultation"} <ArrowRight size={17} />
            </Link>
            <Link href="/salon" className="button-secondary">
              {zh ? "查看发型师流程" : "See the stylist workflow"}
            </Link>
          </div>
          <div className="mt-12 grid gap-4 border-y border-[var(--line)] py-6 text-sm text-[var(--text-muted)] md:grid-cols-3">
            <span>{zh ? "不要求付款" : "No payment required"}</span>
            <span>{zh ? "结果可保存和删除" : "Save and delete results"}</span>
            <span>{zh ? "未来变化会提前说明" : "Future changes announced first"}</span>
          </div>
        </section>
        <footer className="flex flex-wrap gap-5 py-12 text-xs text-[#6f7773]">
          <Link href="/faq" className="underline">{zh ? "常见问题" : "FAQ"}</Link>
          <Link href="/privacy" className="underline">{zh ? "隐私政策" : "Privacy Policy"}</Link>
          <Link href="/terms" className="underline">{zh ? "服务条款" : "Terms of Service"}</Link>
        </footer>
      </div>
    </main>
  );
}
