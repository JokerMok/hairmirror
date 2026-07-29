import Link from "next/link";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n";

export default async function BillingSuccess() {
  const locale = normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const zh = locale === "zh-CN";
  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f2eb] p-5">
      <section className="max-w-lg rounded-3xl bg-white p-9 text-center shadow-sm">
        <h1 className="text-3xl font-semibold">
          {zh ? "付款已提交" : "Payment submitted"}
        </h1>
        <p className="mt-4 leading-7 text-[#6f7773]">
          {zh
            ? "Paddle 确认付款后会自动开通额度。通常几秒内完成，请在账号页查看。"
            : "Your access activates after Paddle confirms the payment. This usually takes a few seconds; check your account for status."}
        </p>
        <Link
          href="/account"
          className="mt-7 inline-flex rounded-full bg-[#1f6b5c] px-6 py-3 text-white"
        >
          {zh ? "查看账号" : "View account"}
        </Link>
      </section>
    </main>
  );
}
