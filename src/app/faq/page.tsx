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
    "Answers about the HairMirror free pilot, salon consultation workflow, photo privacy, and realistic result expectations.",
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
      "Yes. HairMirror is currently in a free pilot. Sign in to create a consultation with three hairstyle directions; no payment is required during this validation phase.",
  },
  {
    question: "What does the free pilot mean?",
    answer:
      "We are validating whether the consultation workflow helps customers and stylists make decisions faster. Paid plans, packs, and salon billing are not active yet; any future change will be announced before payment is requested.",
  },
  {
    question: "How can a stylist use HairMirror with a client?",
    answer:
      "A stylist can create a client consultation, record practical constraints such as length and daily styling time, compare three directions, save one choice, and share the resulting consultation card with the client or team.",
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
        { question: "AI 发型预览是怎样生成的？", answer: "上传清晰的正面照片并选择偏好后，发型镜会生成三个发型方向，供你并排比较。当前免费试用阶段不需要购买次数。" },
        { question: "第一次发型预览免费吗？", answer: "免费。HairMirror 目前处于免费试用阶段，登录后可以创建一次咨询并获得三个发型方向，当前无需付款。" },
        { question: "免费试用阶段是什么意思？", answer: "我们正在验证这套咨询流程是否能帮助客户和发型师更快确定方向。付费次数包、门店订阅和账单功能暂未启用；未来如有变化，会在要求付款前提前说明。" },
        { question: "发型师如何和客户一起使用？", answer: "发型师可以为客户创建咨询，记录发长、打理时间等实际条件，比较三个方向，保存一个选择，并把最终沟通卡发给客户或团队。" },
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
            {zh ? "包括生成方式、免费试用、门店咨询流程、照片保存和效果边界。" : "Clear answers about generation, the free pilot, the salon workflow, photo retention, and realistic expectations."}
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
          <Link href="/salon" className="button-secondary">{zh ? "查看发型师流程" : "See the stylist workflow"}</Link>
          <Link href="/privacy" className="px-3 py-2 text-sm underline">{zh ? "隐私政策" : "Privacy Policy"}</Link>
        </footer>
      </div>
    </main>
  );
}
