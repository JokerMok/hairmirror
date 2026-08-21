import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  Boxes,
  CircleDollarSign,
  KeyRound,
  ListChecks,
  Pencil,
} from "lucide-react";
import { ADMIN_COOKIE, isAdminCookieValue } from "@/lib/session";
import {
  costSummary,
  listGenerationJobs,
  listModelConfigs,
} from "@/lib/model-operations";
import { formatCost, formatCostSummary } from "@/lib/currency";
import { AdminJobAssets } from "@/components/admin-job-assets";

export const dynamic = "force-dynamic";

export default async function ModelsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const authorized = isAdminCookieValue(
    (await cookies()).get(ADMIN_COOKIE)?.value,
  );
  if (!authorized) redirect("/admin");
  const models = listModelConfigs();
  const jobs = listGenerationJobs();
  const cost = costSummary();
  const costTotals = Object.entries(cost.costsByCurrency)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, micros]) => formatCostSummary(Number(micros), currency));
  const created = (await searchParams).created === "1";
  return (
    <main className="min-h-screen bg-[#102a25] p-5 text-white md:p-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white/50">发型镜 · AI OPERATIONS</p>
            <h1 className="mt-1 text-3xl font-semibold">模型与生成运营</h1>
          </div>
          <Link
            href="/admin"
            className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm"
          >
            <ArrowLeft size={16} />
            返回运营台
          </Link>
        </header>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Metric icon={ListChecks} label="已完成任务" value={cost.jobs} />
          <Metric icon={Boxes} label="生成图片" value={cost.images} />
          <Metric
            icon={CircleDollarSign}
            label="累计成本"
            value={costTotals.length > 0 ? costTotals.join(" · ") : "—"}
          />
        </div>
        <div className="mt-7 grid gap-7 lg:grid-cols-[1.15fr_.85fr]">
          <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <div className="border-b border-white/10 p-5">
              <h2 className="text-lg font-semibold">模型配置</h2>
              <p className="mt-1 text-sm text-white/45">
                点击模型即可编辑，密钥仅显示脱敏结果。
              </p>
            </div>
            <div className="grid gap-3 p-5">
              {models.map((model) => (
                <Link
                  href={`/admin/models/${model.id}`}
                  key={model.id}
                  className="group rounded-xl bg-black/15 p-4 transition hover:bg-black/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e5b56d]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <b>{model.name}</b>
                      <p className="mt-1 text-sm text-white/50">
                        {model.provider} · {model.model}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs ${model.enabled ? "bg-emerald-400/15 text-emerald-300" : "bg-white/10 text-white/45"}`}
                      >
                        {model.enabled ? "已启用" : "已停用"}
                      </span>
                      <span className="flex items-center gap-1 rounded-full bg-[#e5b56d] px-3 py-1 text-xs font-medium text-[#102a25]">
                        <Pencil size={12} />
                        编辑配置
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-white/45">
                    <span>优先级 {model.priority}</span>
                    <span>超时 {model.timeoutMs}ms</span>
                    <span>密钥 {model.apiKeyMasked ?? "未配置"}</span>
                    <span>
                      每张 {formatCost(model.costPerImageMicros, model.currency)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <KeyRound className="text-[#e5b56d]" />
            <h2 className="mt-4 text-lg font-semibold">新增供应商</h2>
            {created && (
              <p className="mt-3 rounded-xl bg-emerald-400/10 px-3 py-2 text-sm text-emerald-300">
                配置已保存。
              </p>
            )}
            <form
              action="/api/admin/models"
              method="post"
              className="mt-5 grid gap-3"
            >
              <Input name="name" placeholder="配置名称" />
              <Input name="provider" placeholder="供应商，如 OpenAI" />
              <Input name="model" placeholder="模型名称" />
              <Input
                name="endpoint"
                type="url"
                placeholder="API Endpoint（可选）"
              />
              <Input
                name="apiKey"
                type="password"
                placeholder="API Key（加密保存）"
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  name="priority"
                  type="number"
                  defaultValue="100"
                  placeholder="优先级"
                />
                <Input
                  name="timeoutMs"
                  type="number"
                  defaultValue="120000"
                  placeholder="超时 ms"
                />
              </div>
              <Input
                name="costPerImage"
                type="number"
                min="0"
                max="100"
                step="0.0001"
                defaultValue="0"
                placeholder="每张金额，如 0.015"
              />
              <select
                name="currency"
                className="rounded-xl border border-white/15 bg-[#173f37] px-4 py-3"
              >
                <option value="CNY">CNY</option>
                <option value="USD">USD</option>
              </select>
              <label className="flex items-center gap-2 text-sm text-white/65">
                <input
                  type="checkbox"
                  name="enabled"
                  className="accent-[#e5b56d]"
                />
                立即启用
              </label>
              <button className="rounded-xl bg-white px-4 py-3 font-medium text-[#102a25]">
                保存配置
              </button>
            </form>
          </section>
        </div>
        <section className="mt-7 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="border-b border-white/10 p-5">
            <h2 className="text-lg font-semibold">生成任务队列</h2>
          </div>
          {jobs.length === 0 ? (
            <p className="p-8 text-sm text-white/45">还没有任务。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-white/45">
                  <tr>
                    <th className="p-4">任务</th>
                    <th className="p-4">用户</th>
                    <th className="p-4">模型</th>
                    <th className="p-4">状态</th>
                    <th className="p-4">图片</th>
                    <th className="p-4">成本</th>
                    <th className="p-4">时间</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr
                      key={String(job.id)}
                      className="border-t border-white/10"
                    >
                      <td className="p-4 font-mono">
                        {String(job.task_id).slice(0, 8)}
                      </td>
                      <td className="p-4">
                        {job.user_name ? String(job.user_name) : "匿名"}
                      </td>
                      <td className="p-4">{String(job.model_name ?? "-")}</td>
                      <td className="p-4">{String(job.status)}</td>
                      <td className="p-4">
                        <AdminJobAssets
                          assetIds={job.generated_asset_ids}
                          variantCount={job.variant_count}
                        />
                      </td>
                      <td className="p-4">
                        {formatCost(
                          Number(job.actual_cost_micros),
                          String(job.currency ?? "CNY"),
                        )}
                      </td>
                      <td className="p-4 text-white/50">
                        {new Date(String(job.queued_at)).toLocaleString(
                          "zh-CN",
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Boxes;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <Icon className="text-[#e5b56d]" />
      <p className="mt-5 text-sm text-white/50">{label}</p>
      <b className="mt-1 block text-3xl">{value}</b>
    </div>
  );
}
function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      required={props.name !== "endpoint" && props.name !== "apiKey"}
      className="rounded-xl border border-white/15 bg-black/15 px-4 py-3 placeholder:text-white/30"
      {...props}
    />
  );
}
