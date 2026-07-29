import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ProtectedResultImage } from "@/components/protected-result-image";
import { AUTH_COOKIE, getUserByToken } from "@/lib/auth";
import { LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n";
import { getTaskForOwner } from "@/lib/task-store";

export const dynamic = "force-dynamic";

const englishNames: Record<string, string> = {
  "textured-crop": "Textured crop",
  "clean-side": "Natural side part",
  "soft-waves": "Soft waves",
  "collar-layer": "Collarbone layers",
  "long-layer": "Flowing long layers",
  "french-bob": "French bob",
  "air-bangs": "Long hair with airy bangs",
  "neutral-shag": "Soft neutral shag",
  "long-soft-curl": "Long natural curls",
  "sleek-long": "Sleek long layers",
};

export default async function AccountResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const jar = await cookies();
  const user = getUserByToken(jar.get(AUTH_COOKIE)?.value);
  if (!user) redirect("/login");
  const locale = normalizeLocale(jar.get(LOCALE_COOKIE)?.value);
  const zh = locale === "zh-CN";
  const t = (en: string, cn: string) => (zh ? cn : en);
  const task = getTaskForOwner((await params).id, "", user.id);
  if (!task) notFound();

  return (
    <main className="min-h-screen overflow-x-clip">
      <div className="page-container max-w-6xl py-7">
        <header className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-5">
          <Link
            href="/account"
            className="flex min-h-11 items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--brand)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f6b5c]"
          >
            <ArrowLeft size={16} />
            {t("Back to account", "返回账号")}
          </Link>
          <LocaleSwitcher locale={locale} />
        </header>

        <section className="py-9">
          <p className="text-sm font-semibold text-[#1f6b5c]">
            {t("SAVED PREVIEW", "已保存方案")}
          </p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold md:text-4xl">
                {t("Your hairstyle results", "你的发型生成结果")}
              </h1>
              <p className="mt-2 text-sm text-[#6f7773]">
                {new Date(task.createdAt).toLocaleString(locale)}
              </p>
            </div>
            <span className="rounded-full bg-[#edf3ef] px-4 py-2 text-sm font-medium text-[#1f6b5c]">
              {task.status === "completed"
                ? t("Completed", "已完成")
                : t("Processing", "处理中")}
            </span>
          </div>

          {task.status === "completed" ? (
            <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {task.variants.map((variant) => (
                <article
                  key={variant.id}
                  className="overflow-hidden rounded-3xl border border-[var(--line)] bg-white shadow-[var(--shadow-sm)]"
                >
                  <div className="relative aspect-[4/5] bg-[#e8ece8]">
                    {variant.resultImageUrl ? (
                      <ProtectedResultImage
                        src={variant.resultImageUrl}
                        alt={`${zh ? variant.template.name : englishNames[variant.template.id] || variant.template.name} ${t("preview", "预览")}`}
                        errorLabel={t(
                          "The preview could not be loaded.",
                          "预览图暂时无法加载。",
                        )}
                        retryLabel={t("Reload image", "重新加载")}
                      />
                    ) : (
                      <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-[#6f7773]">
                        {t(
                          "This result image is unavailable.",
                          "该结果图片当前不可用。",
                        )}
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-xl font-semibold">
                        {zh
                          ? variant.template.name
                          : englishNames[variant.template.id] ||
                            variant.template.name}
                      </h2>
                      {task.selectedVariantId === variant.id && (
                        <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#173f37] px-3 py-1 text-xs text-white">
                          <CheckCircle2 size={13} />
                          {t("Selected", "已选择")}
                        </span>
                      )}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[#6f7773]">
                      {zh
                        ? variant.reason
                        : "Created from your saved length, texture, density, face-shape and styling preferences."}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-8 rounded-3xl border border-[var(--line)] bg-white p-8 text-center">
              <p>{t("This preview is still processing.", "该方案仍在处理中。")}</p>
              <Link href="/#studio" className="button-primary mt-5">
                {t("Open hairstyle studio", "返回发型工作台")}
              </Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
