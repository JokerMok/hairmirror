import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Database,
  RefreshCw,
} from "lucide-react";
import { listBackups } from "@/lib/backup";
import { listGenerationJobs } from "@/lib/model-operations";
import {
  listOperationalAlerts,
  listOperationalEvents,
  operationsHealth,
} from "@/lib/operations";
import { ADMIN_COOKIE, adminCookieValue } from "@/lib/session";

export const dynamic = "force-dynamic";
export default async function OperationsPage() {
  const secret = process.env.ADMIN_ACCESS_KEY;
  if (
    !secret ||
    (await cookies()).get(ADMIN_COOKIE)?.value !== adminCookieValue(secret)
  )
    redirect("/admin");
  const health = operationsHealth();
  const alerts = listOperationalAlerts("open");
  const jobs = listGenerationJobs();
  const backups = listBackups();
  const events = listOperationalEvents();
  return (
    <main className="min-h-screen bg-[#102a25] p-5 text-white md:p-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white/50">发型镜 · RELIABILITY</p>
            <h1 className="mt-1 text-3xl font-semibold">队列与系统监控</h1>
          </div>
          <Link
            href="/admin"
            className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm"
          >
            <ArrowLeft size={16} />
            返回运营台
          </Link>
        </header>
        <div className="mt-8 grid gap-4 sm:grid-cols-4">
          <Metric label="排队" value={health.queued} />
          <Metric label="处理中" value={health.processing} />
          <Metric
            label="小时失败率"
            value={`${(health.failureRate * 100).toFixed(0)}%`}
          />
          <Metric label="开放告警" value={alerts.length} />
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <form action="/api/admin/assets/cleanup" method="post">
            <button className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm text-[#102a25]">
              <RefreshCw size={15} />
              执行维护
            </button>
          </form>
          <form action="/api/admin/backup" method="post">
            <button className="flex items-center gap-2 rounded-full bg-[#e5b56d] px-4 py-2 text-sm text-[#102a25]">
              <Database size={15} />
              立即备份
            </button>
          </form>
        </div>
        <section className="mt-7 rounded-2xl border border-white/10 bg-white/5">
          <div className="border-b border-white/10 p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <AlertTriangle size={18} />
              开放告警
            </h2>
          </div>
          {alerts.length === 0 ? (
            <p className="p-5 text-sm text-emerald-300">当前没有开放告警。</p>
          ) : (
            alerts.map((alert) => (
              <div
                key={String(alert.code)}
                className="border-t border-white/10 p-5 first:border-0"
              >
                <b>{String(alert.code)}</b>
                <p className="mt-1 text-sm text-white/60">
                  {String(alert.message)}
                </p>
              </div>
            ))
          )}
        </section>
        <section className="mt-7 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="border-b border-white/10 p-5">
            <h2 className="font-semibold">生成任务</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-white/45">
                <tr>
                  <th className="p-4">任务</th>
                  <th className="p-4">状态</th>
                  <th className="p-4">尝试</th>
                  <th className="p-4">错误</th>
                  <th className="p-4">操作</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={String(job.id)} className="border-t border-white/10">
                    <td className="p-4 font-mono">
                      {String(job.task_id).slice(0, 8)}
                    </td>
                    <td className="p-4">{String(job.status)}</td>
                    <td className="p-4">
                      {String(job.attempts)}/{String(job.max_attempts ?? 3)}
                    </td>
                    <td className="p-4 text-white/50">
                      {String(job.last_error ?? job.error_code ?? "-")}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        {["queued", "processing"].includes(
                          String(job.status),
                        ) && (
                          <form
                            action={`/api/admin/jobs/${job.id}/cancel`}
                            method="post"
                          >
                            <button className="rounded-full bg-white/10 px-3 py-1 text-xs">
                              取消
                            </button>
                          </form>
                        )}
                        {String(job.status) === "failed" && (
                          <form
                            action={`/api/admin/jobs/${job.id}/retry`}
                            method="post"
                          >
                            <button className="rounded-full bg-[#e5b56d] px-3 py-1 text-xs text-[#102a25]">
                              重试
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <div className="mt-7 grid gap-7 md:grid-cols-2">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="font-semibold">最近备份</h2>
            {backups.slice(0, 5).map((item) => (
              <p key={String(item.id)} className="mt-3 text-sm text-white/55">
                {new Date(String(item.created_at)).toLocaleString("zh-CN")} ·{" "}
                {(Number(item.size_bytes) / 1024 / 1024).toFixed(1)} MB
              </p>
            ))}
          </section>
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="font-semibold">最近事件</h2>
            {events.slice(0, 8).map((item) => (
              <p
                key={String(item.id)}
                className="mt-3 flex items-center gap-2 text-sm text-white/55"
              >
                <Activity size={13} />
                {String(item.message)}
              </p>
            ))}
          </section>
        </div>
      </div>
    </main>
  );
}
function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <p className="text-sm text-white/50">{label}</p>
      <b className="mt-2 block text-3xl">{value}</b>
    </div>
  );
}
