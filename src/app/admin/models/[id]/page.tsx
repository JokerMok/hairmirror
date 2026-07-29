import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, KeyRound } from "lucide-react";
import { ADMIN_COOKIE, adminCookieValue } from "@/lib/session";
import { listModelConfigs } from "@/lib/model-operations";

export const dynamic = "force-dynamic";
export default async function ModelSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const secret = process.env.ADMIN_ACCESS_KEY;
  if (
    !secret ||
    (await cookies()).get(ADMIN_COOKIE)?.value !== adminCookieValue(secret)
  )
    redirect("/admin");
  const { id } = await params;
  const model = listModelConfigs().find((item) => item.id === id);
  if (!model) notFound();
  const saved = (await searchParams).saved === "1";
  return (
    <main className="grid min-h-screen place-items-center bg-[#102a25] p-5 text-white">
      <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-7">
        <Link
          href="/admin/models"
          className="flex items-center gap-2 text-sm text-white/55"
        >
          <ArrowLeft size={16} />
          返回模型运营
        </Link>
        <KeyRound className="mt-8 text-[#e5b56d]" />
        <h1 className="mt-4 text-3xl font-semibold">{model.name}</h1>
        <p className="mt-2 text-sm text-white/50">
          {model.provider} · {model.model}
        </p>
        {saved && (
          <p className="mt-5 rounded-xl bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
            配置已保存。
          </p>
        )}
        <form
          action={`/api/admin/models/${model.id}`}
          method="post"
          className="mt-6 grid gap-4"
        >
          <label className="text-sm text-white/65">
            API Key
            <input
              name="apiKey"
              type="password"
              placeholder={
                model.hasApiKey
                  ? `已保存 ${model.apiKeyMasked}，留空表示不更换`
                  : "请输入 RunningHub API Key"
              }
              className="mt-2 w-full rounded-xl border border-white/15 bg-black/15 px-4 py-3 placeholder:text-white/30"
            />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="text-sm text-white/65">
              优先级
              <input
                name="priority"
                type="number"
                min="1"
                max="999"
                defaultValue={model.priority}
                className="mt-2 w-full rounded-xl border border-white/15 bg-black/15 px-4 py-3"
              />
            </label>
            <label className="text-sm text-white/65">
              超时毫秒
              <input
                name="timeoutMs"
                type="number"
                min="1000"
                max="600000"
                defaultValue={model.timeoutMs}
                className="mt-2 w-full rounded-xl border border-white/15 bg-black/15 px-4 py-3"
              />
            </label>
          </div>
          <label className="text-sm text-white/65">
            每张成本（{model.currency}）
            <input
              name="costPerImageYuan"
              type="number"
              min="0"
              max="100"
              step="0.0001"
              defaultValue={model.costPerImageMicros / 1_000_000}
              placeholder="例如 0.07"
              className="mt-2 w-full rounded-xl border border-white/15 bg-black/15 px-4 py-3"
            />
          </label>
          <p className="-mt-2 text-xs text-white/40">
            RunningHub 当前价格可直接填写 0.07。
          </p>
          <label className="flex items-center gap-3 rounded-xl bg-black/15 px-4 py-3 text-sm">
            <input
              name="enabled"
              type="checkbox"
              defaultChecked={model.enabled}
              className="accent-[#e5b56d]"
            />
            启用这个模型
          </label>
          <button className="rounded-xl bg-white px-4 py-3 font-medium text-[#102a25]">
            保存设置
          </button>
        </form>
      </section>
    </main>
  );
}
