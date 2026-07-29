import Link from "next/link";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n";
import { PaddleCheckout } from "./paddle-checkout";

export default async function CheckoutPage({ searchParams }: {
  searchParams: Promise<{ transaction?: string; _ptxn?: string }>;
}) {
  const query = await searchParams;
  // Paddle payment links append `_ptxn`; the app's own checkout flow uses
  // `transaction`. Supporting both keeps this page valid as the account's
  // default payment link and for Paddle-generated payment-management links.
  const transactionId = query.transaction ?? query._ptxn ?? "";
  const locale = normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const zh = locale === "zh-CN";
  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? "";
  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f2eb] p-5">
      <section className="max-w-lg rounded-3xl bg-white p-9 text-center shadow-sm">
        {transactionId && token ? (
          <PaddleCheckout transactionId={transactionId} token={token} sandbox={process.env.PADDLE_ENVIRONMENT !== "production"} zh={zh} />
        ) : (
          <p className="text-red-700">{zh ? "Paddle 尚未配置完成。" : "Paddle is not configured yet."}</p>
        )}
        <Link href="/pricing" className="mt-6 inline-block underline">{zh ? "返回价格页" : "Back to pricing"}</Link>
      </section>
    </main>
  );
}
