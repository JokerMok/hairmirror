import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowLeft, History, UsersRound } from "lucide-react";
import { ADMIN_COOKIE, isAdminCookieValue } from "@/lib/session";
import { listAdminAuditLogs, listUserQuotas } from "@/lib/model-operations";

export const dynamic = "force-dynamic";
const ROLE_LABELS: Record<string, string> = {
  personal: "个人用户",
  store_owner: "门店负责人",
  staff: "门店员工",
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    saved?: string;
    trialReset?: string;
    error?: string;
  }>;
}) {
  if (!isAdminCookieValue((await cookies()).get(ADMIN_COOKIE)?.value))
    redirect("/admin");
  const users = listUserQuotas();
  const logs = listAdminAuditLogs();
  const query = await searchParams;
  return (
    <main className="min-h-screen bg-[#102a25] p-5 text-white md:p-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white/50">发型镜 · USER OPERATIONS</p>
            <h1 className="mt-1 text-3xl font-semibold">用户与额度</h1>
          </div>
          <Link
            href="/admin"
            className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm"
          >
            <ArrowLeft size={16} />
            返回运营台
          </Link>
        </header>
        {query.saved && (
          <p className="mt-6 rounded-xl bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
            额度已更新并写入审计记录。
          </p>
        )}
        {query.trialReset && (
          <p className="mt-6 rounded-xl bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
            免费体验已恢复，不影响用户已购买的次数包。
          </p>
        )}
        {query.error && (
          <p className="mt-6 rounded-xl bg-red-400/10 px-4 py-3 text-sm text-red-200">
            {query.error === "TRIAL_IN_PROGRESS"
              ? "该用户有正在生成的免费体验任务，暂时不能重置。"
              : query.error === "NOT_PERSONAL"
                ? "只有个人账号可以重置免费体验。"
                : "额度不能低于本月已使用和预留数量。"}
          </p>
        )}
        <section className="mt-7 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="flex items-center gap-3 border-b border-white/10 p-5">
            <UsersRound className="text-[#e5b56d]" />
            <div>
              <h2 className="text-lg font-semibold">本月用户额度</h2>
              <p className="mt-1 text-sm text-white/45">
                额度按生成图片张数计算。
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-white/45">
                <tr>
                  <th className="p-4">用户</th>
                  <th className="p-4">角色</th>
                  <th className="p-4">已用</th>
                  <th className="p-4">预留</th>
                  <th className="p-4">剩余</th>
                  <th className="p-4">月额度与免费体验</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const limit = Number(user.limit_count);
                  const used = Number(user.used_count);
                  const reserved = Number(user.reserved_count);
                  return (
                    <tr
                      key={String(user.id)}
                      className="border-t border-white/10"
                    >
                      <td className="p-4">
                        <b>{String(user.name)}</b>
                        <p className="mt-1 font-mono text-xs text-white/45">
                          {user.email
                            ? String(user.email)
                            : String(user.phone).replace(
                                /(\d{3})\d{4}(\d{4})/,
                                "$1****$2",
                              )}
                        </p>
                      </td>
                      <td className="p-4">
                        {ROLE_LABELS[String(user.role)] ?? String(user.role)}
                      </td>
                      <td className="p-4">{used}</td>
                      <td className="p-4">{reserved}</td>
                      <td className="p-4">
                        {Math.max(0, limit - used - reserved)}
                      </td>
                      <td className="p-4">
                        <div className="flex min-w-80 flex-wrap gap-2">
                          <form
                            action={`/api/admin/users/${String(user.id)}/quota`}
                            method="post"
                            className="flex gap-2"
                          >
                            <input
                              aria-label={`${String(user.name)}月额度`}
                              name="limitCount"
                              type="number"
                              min={used + reserved}
                              max="100000"
                              defaultValue={limit}
                              className="w-24 rounded-lg border border-white/15 bg-black/15 px-3 py-2"
                            />
                            <button className="rounded-lg bg-white px-3 py-2 font-medium text-[#102a25] hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                              保存
                            </button>
                          </form>
                          {String(user.role) === "personal" && (
                            <form
                              action={`/api/admin/users/${String(user.id)}/trial`}
                              method="post"
                            >
                              <button className="rounded-lg border border-[#e5b56d]/50 px-3 py-2 font-medium text-[#f2c985] hover:bg-[#e5b56d]/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e5b56d]">
                                重置免费体验
                              </button>
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        <section className="mt-7 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="flex items-center gap-3 border-b border-white/10 p-5">
            <History className="text-[#e5b56d]" />
            <div>
              <h2 className="text-lg font-semibold">管理审计</h2>
              <p className="mt-1 text-sm text-white/45">
                记录额度和模型配置变更。
              </p>
            </div>
          </div>
          {logs.length === 0 ? (
            <p className="p-8 text-sm text-white/45">暂无管理操作记录。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-white/45">
                  <tr>
                    <th className="p-4">操作</th>
                    <th className="p-4">资源</th>
                    <th className="p-4">详情</th>
                    <th className="p-4">时间</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr
                      key={String(log.id)}
                      className="border-t border-white/10"
                    >
                      <td className="p-4">{String(log.action)}</td>
                      <td className="p-4 font-mono text-xs">
                        {String(log.resource_type)} ·{" "}
                        {String(log.resource_id).slice(0, 12)}
                      </td>
                      <td className="max-w-md truncate p-4 font-mono text-xs text-white/50">
                        {String(log.details_json)}
                      </td>
                      <td className="p-4 text-white/50">
                        {new Date(String(log.created_at)).toLocaleString(
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
