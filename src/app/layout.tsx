import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "HairMirror – AI Hairstyle Preview Online",
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "AI hairstyle preview",
    "virtual hairstyle try on",
    "AI haircut simulator",
    "hairstyle generator",
    "haircut preview",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    title: "HairMirror – See Your Next Haircut Before the First Snip",
    description: SITE_DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "HairMirror – AI Hairstyle Preview",
    description: SITE_DESCRIPTION,
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
