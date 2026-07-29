import Link from "next/link";
import { cookies } from "next/headers";
import {
  Activity,
  ArrowLeft,
  CircleDollarSign,
  Images,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { listAllTasks, listFeedback } from "@/lib/task-store";
import { ADMIN_COOKIE, adminCookieValue } from "@/lib/session";
import { listUsers } from "@/lib/database";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const secret = process.env.ADMIN_ACCESS_KEY;
  const jar = await cookies();
  const authorized = Boolean(
    secret && jar.get(ADMIN_COOKIE)?.value === adminCookieValue(secret),
  );
  if (!authorized)
    return (
      <AdminLogin
        configured={Boolean(secret)}
        invalid={(await searchParams).error === "invalid"}
      />
    );
  const tasks = listAllTasks();
  const active = tasks.filter((t) => t.status === "completed");
  const feedback = listFeedback();
  const users = listUsers();
  const willing = feedback.filter((item) => item.issue === "愿意尝试").length;
  const distrust = feedback.filter(
    (item) => item.issue === "预览不可信",
  ).length;
  const cards = [
    { label: "设计任务", value: tasks.length, icon: Images },
    { label: "成功完成", value: active.length, icon: Activity },
    { label: "愿意尝试", value: willing, icon: CircleDollarSign },
    { label: "预览不可信", value: distrust, icon: ShieldCheck },
  ];
  return (
    <main className="min-h-screen bg-[#102a25] p-5 text-white md:p-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white/55">发型镜 · OPERATIONS</p>
            <h1 className="mt-1 text-3xl font-semibold">运营控制台</h1>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Link
              href="/admin/operations"
              className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm"
            >
              <Activity size={16} />
              运行监控
            </Link>
            <Link
              href="/admin/users"
              className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm"
            >
              <UsersRound size={16} />
              用户额度
            </Link>
            <Link
              href="/admin/models"
              className="flex items-center gap-2 rounded-full bg-[#e5b56d] px-4 py-2 text-sm font-medium text-[#102a25]"
            >
              <KeyRound size={16} />
              模型配置
            </Link>
            <Link
              href="/"
              className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
            >
              <ArrowLeft size={16} />
              返回产品
            </Link>
          </div>
        </div>
        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="rounded-2xl border border-white/10 bg-white/5 p-5"
            >
              <Icon className="text-[#e5b56d]" size={20} />
              <p className="mt-5 text-sm text-white/55">{label}</p>
              <b className="mt-1 block font-mono text-3xl">{value}</b>
            </div>
          ))}
        </div>
        <section className="mt-7 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="flex items-center justify-between border-b border-white/10 p-5">
            <div>
              <h2 className="text-lg font-semibold">最近任务</h2>
              <p className="mt-1 text-sm text-white/50">
                仅展示脱敏任务元数据，不读取用户照片。
              </p>
            </div>
            <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs text-emerald-300">
              服务正常
            </span>
          </div>
          {tasks.length === 0 ? (
            <div className="grid min-h-64 place-items-center text-center text-white/45">
              <div>
                <Images className="mx-auto mb-3" />
                <p>还没有设计任务</p>
                <small>完成一次用户端流程后，任务会显示在这里。</small>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-white/45">
                  <tr>
                    <th className="p-4">任务ID</th>
                    <th className="p-4">状态</th>
                    <th className="p-4">方案数</th>
                    <th className="p-4">创建时间</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t) => (
                    <tr key={t.id} className="border-t border-white/10">
                      <td className="p-4 font-mono">{t.id.slice(0, 8)}</td>
                      <td className="p-4">{t.status}</td>
                      <td className="p-4">{t.variants.length}</td>
                      <td className="p-4 text-white/60">
                        {new Date(t.createdAt).toLocaleString("zh-CN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="mt-7 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="flex items-center gap-3 border-b border-white/10 p-5">
            <UsersRound className="text-[#e5b56d]" />
            <div>
              <h2 className="text-lg font-semibold">用户管理</h2>
              <p className="mt-1 text-sm text-white/50">
                {users.length} 个已注册账号
              </p>
            </div>
          </div>
          {users.length === 0 ? (
            <p className="p-8 text-sm text-white/45">还没有注册用户。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-white/45">
                  <tr>
                    <th className="p-4">用户</th>
                    <th className="p-4">登录账号</th>
                    <th className="p-4">角色</th>
                    <th className="p-4">状态</th>
                    <th className="p-4">注册时间</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={String(user.id)}
                      className="border-t border-white/10"
                    >
                      <td className="p-4">{String(user.name)}</td>
                      <td className="p-4 font-mono text-white/60">
                        {user.email
                          ? String(user.email)
                          : String(user.phone).replace(
                              /(\d{3})\d{4}(\d{4})/,
                              "$1****$2",
                            )}
                      </td>
                      <td className="p-4">{String(user.role)}</td>
                      <td className="p-4">{String(user.status)}</td>
                      <td className="p-4 text-white/60">
                        {new Date(String(user.created_at)).toLocaleString(
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

function AdminLogin({
  configured,
  invalid,
}: {
  configured: boolean;
  invalid: boolean;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#102a25] p-5 text-white">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8">
        <LockKeyhole className="text-[#e5b56d]" />
        <h1 className="mt-5 text-3xl font-semibold">运营台受保护</h1>
        <p className="mt-3 text-sm leading-6 text-white/60">
          {configured
            ? "请输入部署环境中配置的运营访问密钥。"
            : "当前未配置 ADMIN_ACCESS_KEY，运营台保持关闭。"}
        </p>
        {invalid && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-red-400/10 px-4 py-3 text-sm text-red-200"
          >
            访问密钥不正确，请重新输入。
          </p>
        )}
        {configured && (
          <form action="/api/admin/login" method="post" className="mt-7">
            <label className="text-sm text-white/70" htmlFor="key">
              访问密钥
            </label>
            <input
              id="key"
              name="key"
              required
              type="password"
              autoComplete="current-password"
              className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 px-4 py-3"
            />
            <button className="mt-4 w-full rounded-xl bg-white py-3 font-medium text-[#102a25]">
              登录运营台
            </button>
          </form>
        )}
        <Link
          href="/"
          className="mt-5 flex items-center justify-center gap-2 text-sm text-white/60"
        >
          <ArrowLeft size={15} />
          返回产品
        </Link>
      </section>
    </main>
  );
}
