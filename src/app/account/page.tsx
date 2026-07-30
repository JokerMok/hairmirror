import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  History,
  LogOut,
  UserRound,
  UsersRound,
} from "lucide-react";
import { AUTH_COOKIE, getUserByToken } from "@/lib/auth";
import {
  BILLING_PLANS,
  billingProvider,
  billingState,
} from "@/lib/billing";
import { listStoreMembers, listUsageRecords } from "@/lib/database";
import { accessSummary } from "@/lib/entitlements";
import { LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n";
import { SESSION_COOKIE } from "@/lib/session";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { listPaddleTransactions } from "@/lib/paddle-billing";

export const dynamic = "force-dynamic";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{
    member?: string;
    billing?: string;
    billing_error?: string;
    activate?: string;
    profile?: string;
    password?: string;
    account_error?: string;
  }>;
}) {
  const jar = await cookies();
  const locale = normalizeLocale(jar.get(LOCALE_COOKIE)?.value);
  const zh = locale === "zh-CN";
  const t = (en: string, cn: string) => (zh ? cn : en);
  const user = getUserByToken(jar.get(AUTH_COOKIE)?.value);
  if (!user) redirect("/login");

  const usage = listUsageRecords(user.id);
  const members = user.storeId ? listStoreMembers(user.storeId) : [];
  const query = await searchParams;
  const memberCreated = query.member === "created";
  const provider = billingProvider();
  const paddleTransactions = provider === "paddle" ? listPaddleTransactions(user.id) : [];
  const subscription = billingState(user.id);
  const access = accessSummary(
    user,
    jar.get(SESSION_COOKIE)?.value ?? "signed-in-account",
  );
  const roleName = zh
    ? { personal: "个人用户", store_owner: "门店管理员", staff: "门店员工" }[
        user.role
      ]
    : {
        personal: "Personal",
        store_owner: "Salon owner",
        staff: "Salon staff",
      }[user.role];
  const planName = subscription
    ? BILLING_PLANS[subscription.planKey]?.name[zh ? "zh" : "en"] ||
      subscription.planKey
    : access.kind === "personal" && access.creditSets > 0
      ? t("Personal Preview Pack", "个人体验次数包")
      : t("Free preview", "免费体验");
  const activationErrors: Record<string, string> = {
    INVALID_LICENSE: t("That license key is invalid.", "License Key 无效。"),
    PRODUCT_MISMATCH: t(
      "This key belongs to a different plan.",
      "该 License Key 不属于所选套餐。",
    ),
    EMAIL_MISMATCH: t(
      "The Gumroad purchase email must match this account email.",
      "Gumroad 购买邮箱必须与当前账号邮箱一致。",
    ),
    CURRENCY_MISMATCH: t(
      "Only USD purchases are supported.",
      "当前仅支持美元购买。",
    ),
    SUBSCRIPTION_REQUIRED: t(
      "This purchase is not an active subscription.",
      "该订单不是有效订阅。",
    ),
    LICENSE_INACTIVE: t(
      "This purchase has ended or was refunded.",
      "该订单已结束或已退款。",
    ),
    LICENSE_ALREADY_BOUND: t(
      "This license is already linked to another account.",
      "该 License Key 已绑定其他账号。",
    ),
    GUMROAD_UNAVAILABLE: t(
      "Gumroad is temporarily unavailable. Try again later.",
      "Gumroad 暂时不可用，请稍后重试。",
    ),
    ACTIVATION_FAILED: t(
      "Activation failed. Check the key and try again.",
      "激活失败，请检查 License Key 后重试。",
    ),
  };
  const activationError = query.billing_error
    ? activationErrors[query.billing_error] ?? activationErrors.ACTIVATION_FAILED
    : null;
  const accountErrors: Record<string, string> = {
    INVALID_INPUT: t(
      "Check the fields and try again.",
      "请检查填写内容后重试。",
    ),
    INVALID_PASSWORD: t(
      "Your current password is incorrect.",
      "当前密码不正确。",
    ),
    PASSWORD_MISMATCH: t(
      "The new passwords do not match.",
      "两次输入的新密码不一致。",
    ),
  };
  const accountError = query.account_error
    ? accountErrors[query.account_error] ?? accountErrors.INVALID_INPUT
    : null;
  const availablePlans: Array<"personal_pack" | "salon_pro"> =
    user.role === "personal"
      ? ["personal_pack"]
      : user.role === "store_owner"
        ? ["salon_pro"]
        : [];

  return (
    <main className="min-h-screen overflow-x-clip">
      <div className="page-container max-w-5xl py-7">
        <header className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-5">
          <Link
            href="/"
            className="flex min-h-11 items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--brand)]"
          >
            <ArrowLeft size={16} />
            {t("Back to HairMirror", "返回发型镜")}
          </Link>
          <div className="flex items-center gap-3">
            <LocaleSwitcher locale={locale} />
            <form action="/api/auth/logout" method="post">
              <button className="button-secondary button-compact">
                <LogOut size={16} />
                {t("Sign out", "退出")}
              </button>
            </form>
          </div>
        </header>

        <section className="mt-10 rounded-[1.75rem] bg-[var(--surface-dark)] p-7 text-white shadow-[var(--shadow-sm)] md:p-9">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div>
              <p className="text-sm text-white/60">
                {t("My account", "我的账号")}
              </p>
              <h1 className="mt-1 text-3xl font-semibold">{user.name}</h1>
              <p className="mt-2 text-sm text-white/65">
                {user.email ||
                  user.phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2")}
              </p>
            </div>
            <span className="rounded-full bg-white/10 px-4 py-2 text-sm">
              {roleName}
            </span>
          </div>
          {user.storeName && (
            <div className="mt-6 flex items-center gap-2 border-t border-white/15 pt-5 text-sm">
              <Building2 size={18} className="text-[#e5b56d]" />
              {user.storeName}
            </div>
          )}
        </section>

        <section className="mt-6 flex flex-wrap items-center justify-between gap-5 rounded-3xl border border-[var(--line)] bg-white p-6 shadow-[var(--shadow-sm)]">
          <div>
            <p className="text-sm text-[#6f7773]">
              {t("Plan and usage", "套餐与次数")}
            </p>
            <h2 className="mt-1 text-xl font-semibold">{planName}</h2>
            <p className="mt-2 text-sm text-[#6f7773]">
              {access.kind === "salon"
                ? t(
                    `${access.remainingSets} of ${access.limitSets} shared previews remaining this month`,
                    `本月门店共享剩余 ${access.remainingSets} / ${access.limitSets} 次完整体验`,
                  )
                : access.creditSets > 0
                  ? t(
                      `${access.creditSets} complete previews remaining`,
                      `剩余 ${access.creditSets} 次完整体验`,
                    )
                  : access.trialAvailable
                    ? t(
                        "One complete preview is available free",
                        "可免费体验 1 次完整生成",
                      )
                    : t("Free preview used", "免费体验已使用")}
            </p>
            {subscription?.cancelAtPeriodEnd && (
              <p className="mt-2 text-sm text-amber-700">
                {t(
                  "Cancellation is scheduled for the end of this billing period.",
                  "订阅将在当前计费周期结束时取消。",
                )}
              </p>
            )}
            {subscription?.status === "stale" && (
              <p className="mt-2 text-sm text-amber-700">
                {t(
                  "Subscription verification is overdue. Paid allowance is paused until Gumroad can verify it.",
                  "订阅验证已超时，Gumroad 重新验证成功前将暂停付费额度。",
                )}
              </p>
            )}
            {query.billing === "activated" && (
              <p className="mt-2 text-sm text-emerald-700">
                {t(
                  "Purchase activated successfully.",
                  "购买权益已成功激活。",
                )}
              </p>
            )}
          </div>
          {(provider === "paddle" && (subscription?.provider === "paddle" || paddleTransactions.length > 0)) ? (
            <form action="/api/billing/portal" method="post">
              <button className="button-primary">
                {t("Manage billing", "管理账单")}
              </button>
            </form>
          ) : subscription && provider === "stripe" ? (
            <form action="/api/billing/portal" method="post">
              <button className="button-primary">
                {t("Manage billing", "管理账单")}
              </button>
            </form>
          ) : subscription?.provider === "gumroad" ? (
            <a
              href="https://gumroad.com/library"
              target="_blank"
              rel="noreferrer"
              className="button-primary"
            >
              {t("Manage on Gumroad", "前往 Gumroad 管理")}
            </a>
          ) : (
            <Link
              href="/pricing"
              className="button-primary"
            >
              {t("View pricing", "查看价格")}
            </Link>
          )}
        </section>

        {provider === "paddle" && paddleTransactions.length > 0 && (
          <section className="mt-6 rounded-3xl border border-[var(--line)] bg-white p-6 shadow-[var(--shadow-sm)]">
            <h2 className="text-xl font-semibold">{t("Billing history", "账单记录")}</h2>
            <div className="mt-5 grid gap-3">
              {paddleTransactions.map((payment) => (
                <div key={String(payment.transaction_id)} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--line)] p-4">
                  <div>
                    <b>{new Intl.NumberFormat(locale, { style: "currency", currency: String(payment.currency_code) }).format(Number(payment.total_amount) / 100)}</b>
                    <span className="ml-3 text-sm text-[#6f7773]">{payment.billed_at ? new Date(String(payment.billed_at)).toLocaleString(locale) : ""}</span>
                    <small className="mt-1 block text-[#6f7773]">{String(payment.invoice_number ?? payment.transaction_id)}</small>
                    <small className={`mt-1 block ${payment.status === "refunded" ? "text-amber-700" : "text-emerald-700"}`}>
                      {payment.status === "refunded" ? t("Refunded", "已退款") : t("Paid", "已支付")}
                    </small>
                  </div>
                  <a href={`/api/billing/invoices/${encodeURIComponent(String(payment.transaction_id))}`} className="button-secondary button-compact">
                    {t("Download invoice", "下载账单")}
                  </a>
                </div>
              ))}
            </div>
          </section>
        )}

        {provider === "gumroad" && availablePlans.length > 0 && (
          <section
            id="activate"
            className="mt-6 rounded-3xl border border-[var(--line)] bg-white p-6 shadow-[var(--shadow-sm)]"
          >
            <h2 className="text-xl font-semibold">
              {t("Activate Gumroad purchase", "激活 Gumroad 购买权益")}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#6f7773]">
              {t(
                "After purchase, enter the license key from your Gumroad receipt. The purchase email must match this account.",
                "购买后输入 Gumroad 收据中的 License Key，购买邮箱须与当前账号一致。",
              )}
            </p>
            {activationError && (
              <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {activationError}
              </p>
            )}
            <form
              action="/api/billing/gumroad/activate"
              method="post"
              className="mt-5 grid gap-3 md:grid-cols-[220px_1fr_auto]"
            >
              <select
                name="plan"
                required
                className="rounded-xl border border-[#cfd7d2] bg-white px-4 py-3"
              >
                {availablePlans.map((key) => (
                  <option key={key} value={key}>
                    {key === "personal_pack"
                      ? t("Personal Preview Pack", "个人体验次数包")
                      : BILLING_PLANS.salon_pro.name[zh ? "zh" : "en"]}
                  </option>
                ))}
              </select>
              <input
                name="licenseKey"
                required
                minLength={16}
                maxLength={256}
                autoComplete="off"
                placeholder="XXXX-XXXX-XXXX-XXXX"
                className="rounded-xl border border-[#cfd7d2] bg-white px-4 py-3"
              />
              <button className="button-primary rounded-xl">
                {t("Activate", "立即激活")}
              </button>
            </form>
            <p className="mt-3 text-xs text-[#7a817e]">
              {t(
                "Subscription keys are encrypted. Pack keys are retained only as a one-way fingerprint.",
                "订阅密钥会加密保存；次数包密钥仅保留不可逆指纹。",
              )}
            </p>
          </section>
        )}

        <section className="mt-6 rounded-3xl border border-[var(--line)] bg-white p-6 shadow-[var(--shadow-sm)]">
          <div className="flex items-center gap-2">
            <UserRound className="text-[#1f6b5c]" />
            <h2 className="text-xl font-semibold">
              {t("Account settings", "账号设置")}
            </h2>
          </div>
          {query.profile === "updated" && (
            <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {t("Account information saved.", "账号信息已保存。")}
            </p>
          )}
          {query.password === "updated" && (
            <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {t("Password changed.", "密码已修改。")}
            </p>
          )}
          {accountError && (
            <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {accountError}
            </p>
          )}
          <div className="mt-5 grid gap-7 lg:grid-cols-2">
            <form
              action="/api/account/profile"
              method="post"
              className="grid content-start gap-3"
            >
              <h3 className="font-semibold">
                {t("Profile information", "基本资料")}
              </h3>
              <label className="grid gap-1.5 text-sm text-[#525a56]">
                {t("Display name", "显示名称")}
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={30}
                  defaultValue={user.name}
                  autoComplete="name"
                  className="rounded-xl border border-[#cfd7d2] bg-white px-4 py-3 text-[#17211d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f6b5c]"
                />
              </label>
              <label className="grid gap-1.5 text-sm text-[#525a56]">
                {t("Email", "邮箱")}
                <input
                  type="email"
                  value={user.email ?? ""}
                  readOnly
                  disabled
                  aria-describedby="account-email-note"
                  className="cursor-not-allowed rounded-xl border border-[#d9dedb] bg-[#f3f5f3] px-4 py-3 text-[#69716d]"
                />
                <span id="account-email-note" className="text-xs leading-5 text-[#7a817e]">
                  {t(
                    "This is your sign-in account and cannot be changed.",
                    "该邮箱是登录账号，不能修改。",
                  )}
                </span>
              </label>
              {user.role === "store_owner" && (
                <label className="grid gap-1.5 text-sm text-[#525a56]">
                  {t("Salon name", "门店名称")}
                  <input
                    name="storeName"
                    required
                    minLength={2}
                    maxLength={50}
                    defaultValue={user.storeName ?? ""}
                    className="rounded-xl border border-[#cfd7d2] bg-white px-4 py-3 text-[#17211d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f6b5c]"
                  />
                </label>
              )}
              <label className="grid gap-1.5 text-sm text-[#525a56]">
                {t("Current password", "当前密码")}
                <input
                  name="currentPassword"
                  required
                  type="password"
                  minLength={8}
                  maxLength={72}
                  autoComplete="current-password"
                  className="rounded-xl border border-[#cfd7d2] bg-white px-4 py-3 text-[#17211d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f6b5c]"
                />
              </label>
              <button className="button-primary mt-1 w-fit rounded-xl">
                {t("Save account information", "保存账号信息")}
              </button>
            </form>

            <form
              action="/api/account/password"
              method="post"
              className="grid content-start gap-3 border-t border-[var(--line)] pt-6 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0"
            >
              <h3 className="font-semibold">
                {t("Change password", "修改密码")}
              </h3>
              <label className="grid gap-1.5 text-sm text-[#525a56]">
                {t("Current password", "当前密码")}
                <input
                  name="currentPassword"
                  required
                  type="password"
                  minLength={8}
                  maxLength={72}
                  autoComplete="current-password"
                  className="rounded-xl border border-[#cfd7d2] bg-white px-4 py-3 text-[#17211d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f6b5c]"
                />
              </label>
              <label className="grid gap-1.5 text-sm text-[#525a56]">
                {t("New password", "新密码")}
                <input
                  name="newPassword"
                  required
                  type="password"
                  minLength={8}
                  maxLength={72}
                  autoComplete="new-password"
                  className="rounded-xl border border-[#cfd7d2] bg-white px-4 py-3 text-[#17211d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f6b5c]"
                />
              </label>
              <label className="grid gap-1.5 text-sm text-[#525a56]">
                {t("Confirm new password", "确认新密码")}
                <input
                  name="confirmPassword"
                  required
                  type="password"
                  minLength={8}
                  maxLength={72}
                  autoComplete="new-password"
                  className="rounded-xl border border-[#cfd7d2] bg-white px-4 py-3 text-[#17211d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f6b5c]"
                />
              </label>
              <button className="button-secondary mt-1 w-fit rounded-xl">
                {t("Change password", "修改密码")}
              </button>
            </form>
          </div>
        </section>

        <div
          className={`mt-6 grid gap-6 ${user.role === "store_owner" ? "lg:grid-cols-2" : ""}`}
        >
          <section className="rounded-3xl border border-[var(--line)] bg-white p-6 shadow-[var(--shadow-sm)]">
            <div className="flex items-center gap-2">
              <History className="text-[#1f6b5c]" />
              <h2 className="text-xl font-semibold">
                {t("Usage history", "使用记录")}
              </h2>
            </div>
            <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-[var(--line)] bg-[#f8faf8] p-4">
              <div>
                <b className="block">{t("Consultation history", "咨询历史")}</b>
                <span className="mt-1 block text-sm text-[#6f7773]">
                  {t("Saved AI analysis and recommendations", "查看已保存的 AI 分析与推荐")}
                </span>
              </div>
              <Link
                href="/account/consultations"
                className="group inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-[#1f6b5c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f6b5c]"
              >
                {t("View", "查看")}
                <ChevronRight size={16} className="transition group-hover:translate-x-0.5" />
              </Link>
            </div>
            {usage.length === 0 ? (
              <p className="mt-8 text-sm text-[#6f7773]">
                {t("No hairstyle generations yet.", "还没有发型设计记录。")}
              </p>
            ) : (
              <div className="mt-5 grid gap-3">
                {usage.map((item) => (
                  <Link
                    key={String(item.task_id)}
                    href={`/account/results/${String(item.task_id)}`}
                    className="group rounded-2xl border border-[var(--line)] bg-white p-4 transition hover:border-[#9eb5ac] hover:bg-[#f8faf8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f6b5c]"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <b>
                          {t(
                            `${Number(item.variant_count)} hairstyle options`,
                            `${Number(item.variant_count)} 个发型方案`,
                          )}
                        </b>
                        <span className="mt-1 block text-xs text-[#6f7773]">
                          {new Date(String(item.created_at)).toLocaleString(
                            locale,
                          )}
                        </span>
                      </div>
                      <span className="flex items-center gap-1 text-sm font-semibold text-[#1f6b5c]">
                        {t("View", "查看")}
                        <ChevronRight
                          size={16}
                          className="transition group-hover:translate-x-0.5"
                        />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {user.role === "store_owner" ? (
            <section className="rounded-3xl border border-[var(--line)] bg-white p-6 shadow-[var(--shadow-sm)]">
              <div className="flex items-center gap-2">
                <UsersRound className="text-[#1f6b5c]" />
                <h2 className="text-xl font-semibold">
                  {t("Salon staff", "门店员工")}
                </h2>
              </div>
              {memberCreated && (
                <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {t("Staff account created.", "员工账号已创建。")}
                </p>
              )}
              <div className="mt-5 grid gap-2">
                {members.map((member) => (
                  <div
                    key={String(member.id)}
                    className="flex items-center justify-between rounded-xl bg-white px-4 py-3"
                  >
                    <span>
                      <b className="block">{String(member.name)}</b>
                      <small className="text-[#6f7773]">
                        {member.email
                          ? String(member.email)
                          : String(member.phone).replace(
                              /(\d{3})\d{4}(\d{4})/,
                              "$1****$2",
                            )}
                      </small>
                    </span>
                    <small>
                      {member.role === "store_owner"
                        ? t("Owner", "管理员")
                        : t("Staff", "员工")}
                    </small>
                  </div>
                ))}
              </div>
              <form
                action="/api/store/members"
                method="post"
                className="mt-6 grid gap-3 border-t border-[#dce1dc] pt-5"
              >
                <h3 className="font-medium">
                  {t("Create staff account", "创建员工账号")}
                </h3>
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={30}
                  placeholder={t("Staff name", "员工姓名")}
                  className="rounded-xl border border-[#cfd7d2] bg-white px-4 py-3"
                />
                <input
                  name="email"
                  required
                  type="email"
                  autoComplete="email"
                  placeholder={t("Staff email", "员工邮箱")}
                  className="rounded-xl border border-[#cfd7d2] bg-white px-4 py-3"
                />
                <input
                  name="password"
                  required
                  type="password"
                  minLength={8}
                  maxLength={72}
                  autoComplete="new-password"
                  placeholder={t(
                    "Temporary password (8+ characters)",
                    "初始密码（至少8位）",
                  )}
                  className="rounded-xl border border-[#cfd7d2] bg-white px-4 py-3"
                />
                <button className="button-primary rounded-xl">
                  {t("Create staff account", "创建员工")}
                </button>
              </form>
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}
