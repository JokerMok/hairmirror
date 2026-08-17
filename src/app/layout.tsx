import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n";
import {
  absoluteUrl,
  SITE_DESCRIPTION,
  SITE_DESCRIPTION_ZH,
  SITE_NAME,
  SITE_URL,
} from "@/lib/site";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const locale = normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const zh = locale === "zh-CN";
  const title = zh
    ? "发型镜｜剪发前先看见下一款发型"
    : "HairMirror – See Your Next Haircut Before the First Snip";
  const description = zh ? SITE_DESCRIPTION_ZH : SITE_DESCRIPTION;
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: `%s | ${SITE_NAME}` },
    description,
    applicationName: SITE_NAME,
    keywords: zh
      ? ["AI 发型预览", "发型设计", "剪发参考", "发型师咨询"]
      : [
          "AI hairstyle preview",
          "virtual hairstyle try on",
          "AI haircut simulator",
          "hairstyle generator",
          "haircut preview",
        ],
    alternates: { canonical: absoluteUrl("/") },
    openGraph: {
      type: "website",
      url: absoluteUrl("/"),
      siteName: SITE_NAME,
      title,
      description,
      locale: zh ? "zh_CN" : "en_US",
      images: [
        {
          url: absoluteUrl("/image2-hairstyle-board.png"),
          width: 1797,
          height: 875,
          alt: zh ? "三种 AI 发型方向对比" : "Three AI hairstyle directions compared",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [absoluteUrl("/image2-hairstyle-board.png")],
    },
    verification: {
      google: "Z4MQUgq14AT9xLlJKWSyLWUWP8MMgPQOV0RGD52Ar68",
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  return (
    <html lang={locale} className="h-full">
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
