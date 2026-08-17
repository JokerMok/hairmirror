import { SUPPORT_EMAIL, supportMailto } from "@/lib/support";
import type { Locale } from "@/lib/i18n";

export function SupportContact({
  locale,
  subject = "HairMirror support request",
}: {
  locale: Locale;
  subject?: string;
}) {
  const zh = locale === "zh-CN";
  const href = supportMailto(subject);
  return href ? (
    <a href={href} className="font-medium text-[var(--brand)] underline underline-offset-4">
      {SUPPORT_EMAIL}
    </a>
  ) : (
    <span>{zh ? "支持邮箱将在邀请外部试用前配置并公布。" : "A support email will be configured and published before external pilot invitations."}</span>
  );
}
