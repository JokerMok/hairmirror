import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How HairMirror processes, retains, and deletes uploaded photos, hairstyle results, and account information during its free pilot.",
  alternates: { canonical: "/privacy" },
};

export default async function PrivacyPage() {
  const zh =
    normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value) === "zh-CN";
  const sections = zh
    ? [
        {
          t: "一、处理的信息",
          b: "我们处理你主动提交的照片、发型偏好、生成方案、选择和反馈。注册用户还会提供邮箱或手机号、昵称和加密后的登录凭据。当前免费试用阶段不要求付款，暂不收集完整银行卡信息。",
        },
        {
          t: "二、使用目的",
          b: "信息用于生成发型预览、恢复咨询记录、支持客户与发型师沟通、排查故障和保障系统安全。我们不会以识别身份为目的建立人脸识别模板，也不会将照片用于模型训练，除非另行取得明确同意。",
        },
        {
          t: "三、服务商",
          b: "启用 RunningHub 时，照片和生成指令会发送给该图像服务商。当前试用阶段没有启用付款服务商或订阅账单。服务商只获得完成对应服务所需的信息。",
        },
        {
          t: "四、保存与删除",
          b: "原照片在成功或取消后立即删除，连续失败时最多保留 24 小时。生成结果、方案、选择和反馈默认保留 30 天。你可以提前删除；不含照片的交易、费用和安全记录可按法律及财务要求继续保存。",
        },
        {
          t: "五、你的权利",
          b: "你可以访问或删除生成记录，并通过运营方公布的支持渠道申请访问、更正或删除账号资料。美国部分州的居民还可依法提出隐私权请求。若未来启用付费功能，我们会在付款前更新相关说明。",
        },
      ]
    : [
        {
          t: "1. Information we process",
          b: "We process photos, hairstyle preferences, generated options, selections, and feedback that you submit. Registered users also provide an email address or phone number, display name, and encrypted login credentials. No payment is required during the current free pilot, and we do not collect full card numbers.",
        },
        {
          t: "2. Why we use it",
          b: "We use this information to generate hairstyle previews, restore consultation history, support customer–stylist communication, diagnose failures, and protect the service. We do not create face-recognition templates to identify you, and we do not use photos for model training unless we obtain separate explicit consent.",
        },
        {
          t: "3. Service providers",
          b: "When RunningHub is enabled, the photo and generation instructions are sent to that image provider. No payment or subscription provider is active during the current pilot. Providers receive only the information needed to perform their service.",
        },
        {
          t: "4. Retention and deletion",
          b: "Source photos are deleted immediately after successful generation or cancellation and retained for no more than 24 hours after repeated failure. Results, options, selections, and feedback are retained for 30 days by default. You may delete them sooner. Transaction, cost, fraud-prevention, and security records that contain no photos may be retained as required by law and accounting rules.",
        },
        {
          t: "5. Your choices and rights",
          b: "You can access or delete generation records and use the operator's published support channel to request access, correction, or deletion of account data. If paid features are introduced, this policy will be updated before payment is requested. Residents of certain US states may have additional privacy rights under applicable law.",
        },
      ];
  return (
    <main className="min-h-screen overflow-x-clip">
      <article className="page-container max-w-3xl py-14 md:py-20">
        <p className="text-sm text-[#6c7772]">
          {zh ? "生效日期：2026 年 7 月 15 日" : "Effective July 15, 2026"}
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-.04em] md:text-5xl">
          {zh ? "发型镜隐私政策" : "HairMirror Privacy Policy"}
        </h1>
        <p className="mt-5 text-sm leading-7 text-[#56615d]">
          {zh
            ? "使用照片生成功能前，请阅读并确认本政策。不同意照片处理不会影响浏览产品，但无法使用生成功能。"
            : "Read this policy before using photo generation. You may browse without consenting, but photo generation requires consent."}
        </p>
        <div className="mt-10 divide-y divide-[var(--line)] border-y border-[var(--line)]">
          {sections.map((x) => (
            <section key={x.t} className="py-7 md:grid md:grid-cols-[210px_1fr] md:gap-8">
              <h2 className="font-semibold text-[var(--foreground)]">{x.t}</h2>
              <p className="mt-2 text-sm leading-7 text-[#56615d]">{x.b}</p>
            </section>
          ))}
        </div>
        <div className="mt-9 flex gap-4 text-sm">
          <Link
            href="/"
            className="button-primary"
          >
            {zh ? "返回发型镜" : "Back to HairMirror"}
          </Link>
          <Link href="/terms" className="px-3 py-2.5 underline">
            {zh ? "服务条款" : "Terms"}
          </Link>
        </div>
      </article>
    </main>
  );
}
