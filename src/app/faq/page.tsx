import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { Scissors } from "lucide-react";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { StructuredData } from "@/components/structured-data";
import { LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "AI Hairstyle Preview FAQ",
  description:
    "Answers about HairMirror AI hairstyle previews, free trials, personal packs, salon plans, photo privacy, and result limitations.",
  alternates: { canonical: "/faq" },
};

const ENGLISH_FAQ = [
  {
    question: "How does the AI hairstyle preview work?",
    answer:
      "Upload a clear front-facing photo, choose your preferences, and HairMirror creates three hairstyle directions for side-by-side comparison. Each complete preview uses one credit.",
  },
  {
    question: "Is the first hairstyle preview free?",
    answer:
      "Yes. Create an account and sign in to receive one free complete preview. It includes three hairstyle directions and does not require payment.",
  },
  {
    question: "What is included in the Personal Preview Pack?",
    answer:
      "The Personal Preview Pack costs $1.99 USD and includes five complete previews. Each preview returns three hairstyle directions. Credits do not expire, and failed or cancelled jobs do not consume a credit.",
  },
  {
    question: "What is included in the Salon Pro plan?",
    answer:
      "Salon Pro costs $29 USD per month and includes 200 complete previews shared by the salon owner and staff accounts, plus saved history and subscription management through Gumroad.",
  },
  {
    question: "How does HairMirror protect uploaded photos?",
    answer:
      "Source photos are deleted after successful generation or cancellation. After repeated failure, they are retained for no more than 24 hours. Generated results and related choices are retained for 30 days by default and can be deleted sooner.",
  },
  {
    question: "Will the real haircut look exactly like the AI preview?",
    answer:
      "Not necessarily. HairMirror is a planning and communication tool. Hair texture, density, current length, styling, and the stylist's technique affect the real result, so confirm the final direction with a professional.",
  },
];

export default async function FaqPage() {
  const locale = normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const zh = locale === "zh-CN";
  const items = zh
    ? [
        { question: "AI 发型预览是怎样生成的？", answer: "上传清晰的正面照片并选择偏好后，发型镜会生成三个发型方向，供你并排比较。每次完整体验消耗一个次数。" },
        { question: "第一次发型预览免费吗？", answer: "免费。注册并登录后可获得一次完整体验，包含三个发型方向，无需付款。" },
        { question: "个人次数包含什么？", answer: "个人次数包价格为 1.99 美元，包含 5 次完整体验，每次返回三个发型方向。次数不过期，任务失败或取消不会扣除次数。" },
        { question: "Salon Pro 门店版包含什么？", answer: "Salon Pro 价格为每月 29 美元，包含 200 次完整体验，由店主和员工账号共享，并提供历史记录及 Gumroad 订阅管理。" },
        { question: "上传照片如何保护？", answer: "原照片在成功生成或取消后删除；连续失败时最多保留 24 小时。生成结果及相关选择默认保留 30 天，也可提前删除。" },
        { question: "实际剪发会和 AI 预览完全一样吗？", answer: "不一定。发型镜用于方案规划和沟通。实际效果还会受到发质、发量、当前长度、造型方式和发型师技术影响，请与专业发型师确认最终方案。" },
      ]
    : ENGLISH_FAQ;

  return (
    <main className="min-h-screen overflow-x-clip">
      <StructuredData
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          url: absoluteUrl("/faq"),
          mainEntity: items.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: { "@type": "Answer", text: item.answer },
          })),
        }}
      />
      <div className="page-container max-w-4xl">
        <header className="site-header !w-full">
          <Link href="/" className="brand-lockup">
            <span className="brand-mark"><Scissors size={18} /></span>
            <span><b>{zh ? "发型镜" : "HairMirror"}</b><small>{zh ? "AI 发型设计" : "AI hairstyle studio"}</small></span>
          </Link>
          <LocaleSwitcher locale={locale} />
        </header>
        <section className="pb-12 pt-16 md:pb-16 md:pt-24">
          <p className="eyebrow">{zh ? "常见问题" : "FREQUENTLY ASKED QUESTIONS"}</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-.045em] md:text-6xl">
            {zh ? "使用前，你可能想了解这些" : "Everything to know before your first preview"}
          </h1>
          <p className="mt-6 max-w-2xl leading-7 text-[var(--text-muted)]">
            {zh ? "包括生成方式、价格、免费体验、照片保存和效果边界。" : "Clear answers about generation, pricing, the free preview, photo retention, and realistic expectations."}
          </p>
        </section>
        <div className="border-y border-[var(--line)]">
          {items.map((item, index) => (
            <section key={item.question} className="grid gap-3 border-b border-[var(--line)] py-7 last:border-b-0 md:grid-cols-[52px_1fr] md:gap-6 md:py-9">
              <span className="text-sm font-semibold text-[var(--brand)]">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h2 className="text-xl font-semibold tracking-[-.02em] md:text-2xl">{item.question}</h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-muted)] md:text-base">{item.answer}</p>
              </div>
            </section>
          ))}
        </div>
        <footer className="flex flex-wrap items-center gap-3 py-12">
          <Link href="/#studio" className="button-primary">{zh ? "开始免费体验" : "Start your free preview"}</Link>
          <Link href="/pricing" className="button-secondary">{zh ? "查看价格" : "View pricing"}</Link>
          <Link href="/privacy" className="px-3 py-2 text-sm underline">{zh ? "隐私政策" : "Privacy Policy"}</Link>
        </footer>
      </div>
    </main>
  );
}
