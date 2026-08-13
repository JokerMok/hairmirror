"use client";

import Image from "next/image";
import Link from "next/link";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ImagePlus,
  LoaderCircle,
  Scissors,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ProtectedResultImage } from "@/components/protected-result-image";
import { FeedbackSection, HomeShowcase } from "@/components/home-showcase";
import type { Locale } from "@/lib/i18n";
import type {
  DesignPreferences,
  DesignTask,
  HairGoal,
  HairLength,
} from "@/lib/types";
import { DEFAULT_DESIGN_PREFERENCES } from "@/lib/types";

const initial: DesignPreferences = DEFAULT_DESIGN_PREFERENCES;
export function StudioWizard({
  locale,
  authenticated,
}: {
  locale: Locale;
  authenticated: boolean;
}) {
  const isZh = locale === "zh-CN";
  const t = (en: string, zh: string) => (isZh ? zh : en);
  const lengths: { value: HairLength; label: string }[] = [
    { value: "short", label: t("Short", "短发") },
    { value: "medium", label: t("Medium", "中发") },
    { value: "long", label: t("Long", "长发") },
  ];
  const goalLabels: Record<HairGoal, string> = {
    fresh: t("Fresh and clean", "清爽精神"),
    younger: t("Look younger", "显年轻"),
    volume: t("More volume", "增加发量感"),
    professional: t("Professional", "职业感"),
    fashion: t("Fashion-forward", "时尚感"),
  };
  const textureLabels: Record<DesignPreferences["texture"], string> = {
    straight: t("Straight", "直发"),
    wavy: t("Wavy", "自然波浪"),
    curly: t("Curly", "卷发"),
    coily: t("Coily", "紧密卷发"),
  };
  const densityLabels: Record<DesignPreferences["density"], string> = {
    fine: t("Fine / less dense", "细软 / 发量偏少"),
    medium: t("Medium", "中等"),
    thick: t("Thick / dense", "粗硬 / 发量浓密"),
  };
  const faceShapeLabels: Record<DesignPreferences["faceShape"], string> = {
    auto: t("Let AI assess", "由 AI 判断"),
    oval: t("Oval", "椭圆脸"),
    round: t("Round", "圆脸"),
    square: t("Square", "方脸"),
    heart: t("Heart", "心形脸"),
    long: t("Long", "长脸"),
  };
  const fringeLabels: Record<DesignPreferences["fringe"], string> = {
    open: t("No preference", "不限"),
    avoid: t("No fringe", "不要刘海"),
    soft: t("Soft / curtain fringe", "轻薄 / 八字刘海"),
    full: t("Full fringe", "完整刘海"),
  };
  const partingLabels: Record<DesignPreferences["parting"], string> = {
    auto: t("No preference", "不限"),
    center: t("Center part", "中分"),
    side: t("Side part", "侧分"),
  };
  const englishStyles: Record<string, { name: string; conditions: string }> = {
    "textured-crop": {
      name: "Textured crop",
      conditions:
        "Works with short hair; style with a small amount of matte paste.",
    },
    "clean-side": {
      name: "Natural side part",
      conditions: "Keep enough length on top to form the part.",
    },
    "soft-waves": {
      name: "Soft waves",
      conditions: "Straight hair may need a perm or a curling tool.",
    },
    "collar-layer": {
      name: "Collarbone layers",
      conditions: "Current length should reach at least the jawline.",
    },
    "long-layer": {
      name: "Flowing long layers",
      conditions: "Fine hair may need volume styling.",
    },
    "french-bob": {
      name: "French bob",
      conditions: "Requires a defined cut near the jawline.",
    },
    "air-bangs": {
      name: "Long hair with airy bangs",
      conditions:
        "Bangs need daily styling and more frequent care for oily hair.",
    },
    "neutral-shag": {
      name: "Soft neutral shag",
      conditions:
        "Keep length at the nape and be comfortable with visible layers.",
    },
    "long-soft-curl": {
      name: "Long natural curls",
      conditions: "Keep chest-length hair and add loose curls for volume.",
    },
    "sleek-long": {
      name: "Sleek long layers",
      conditions: "Keep the hair chest-length with light face-framing layers.",
    },
  };
  const styleName = (template: DesignTask["variants"][number]["template"]) =>
    isZh ? template.name : englishStyles[template.id]?.name || template.name;
  const styleConditions = (
    template: DesignTask["variants"][number]["template"],
  ) =>
    isZh
      ? template.conditions
      : englishStyles[template.id]?.conditions || template.conditions;
  const maintenanceLabel = (value: "低" | "中" | "高") =>
    isZh ? value : { 低: "Low", 中: "Medium", 高: "High" }[value];
  const feedbackSignals = [
    { value: "像本人", label: t("Looks like me", "像本人") },
    { value: "现实可实现", label: t("Feels achievable", "现实可实现") },
    { value: "愿意尝试", label: t("Would try it", "愿意尝试") },
    { value: "预览不可信", label: t("Preview feels inaccurate", "预览不可信") },
  ];
  const [step, setStep] = useState(0);
  const [preview, setPreview] = useState("");
  const [consent, setConsent] = useState(false);
  const [preferences, setPreferences] = useState(initial);
  const [task, setTask] = useState<DesignTask | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errorAction, setErrorAction] = useState<"login" | null>(null);
  const [selected, setSelected] = useState("");
  const [resultSignal, setResultSignal] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [copied, setCopied] = useState(false);
  const [recentTasks, setRecentTasks] = useState<DesignTask[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  function openPhotoPicker() {
    if (!authenticated) {
      window.location.assign("/login?next=%2F%23studio");
      return;
    }
    inputRef.current?.click();
  }

  useEffect(() => {
    fetch("/api/design-tasks")
      .then((response) => (response.ok ? response.json() : { tasks: [] }))
      .then((data) => setRecentTasks(data.tasks ?? []))
      .catch(() => setRecentTasks([]));
  }, []);
  const activeTaskId = task?.id;
  const activeTaskStatus = task?.status;
  useEffect(() => {
    if (
      !activeTaskId ||
      !["queued", "processing"].includes(activeTaskStatus ?? "")
    )
      return;
    const timer = window.setInterval(() => {
      fetch(`/api/design-tasks/${activeTaskId}`)
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (!data?.task) return;
          setTask(data.task);
          setRecentTasks((items) =>
            [
              data.task,
              ...items.filter((item) => item.id !== data.task.id),
            ].slice(0, 6),
          );
          if (data.task.selectedVariantId)
            setSelected(data.task.selectedVariantId);
        })
        .catch(() => {});
    }, 2000);
    return () => window.clearInterval(timer);
  }, [activeTaskId, activeTaskStatus]);

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 8 * 1024 * 1024
    ) {
      setError(
        t(
          "Upload a JPG, PNG, or WebP image no larger than 8 MB.",
          "请上传 8MB 以内的 JPG、PNG 或 WebP 图片。",
        ),
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(String(reader.result));
      setError("");
    };
    reader.readAsDataURL(file);
  }
  async function generate() {
    setLoading(true);
    setError("");
    setErrorAction(null);
    try {
      const response = await fetch("/api/design-tasks", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": crypto.randomUUID(),
        },
        body: JSON.stringify({ consent, preferences, imageDataUrl: preview }),
      });
      if (!response.ok) {
        const failure = await response
          .json()
          .catch(() => ({ error: "UNKNOWN" }));
        throw new Error(failure.error);
      }
      const data = await response.json();
      setTask(data.task);
      setRecentTasks((items) =>
        [data.task, ...items.filter((item) => item.id !== data.task.id)].slice(
          0,
          6,
        ),
      );
      setStep(3);
    } catch (error) {
      const code = error instanceof Error ? error.message : "UNKNOWN";
      setErrorAction(
        code === "AUTH_REQUIRED"
          ? "login"
          : null,
      );
      setError(
        code === "AUTH_REQUIRED"
          ? t(
              "Sign in to receive your free complete preview.",
              "登录后可获得 1 次免费完整体验。",
            )
          : code === "PAYMENT_REQUIRED"
          ? t(
              "Paid access is not enabled during this pilot yet. Contact us if you need more test runs.",
              "当前试用阶段尚未开放付费入口，如需更多测试次数请联系试用负责人。",
            )
          : t(
              "We could not generate styles right now. Try again later.",
              "暂时无法生成，请稍后重试。",
            ),
      );
    } finally {
      setLoading(false);
    }
  }
  async function removeTask() {
    if (task) {
      const response = await fetch(`/api/design-tasks/${task.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        setError(
          t(
            "Could not delete this record. Refresh and try again.",
            "删除失败，请刷新页面后重试。",
          ),
        );
        return;
      }
    }
    setTask(null);
    setPreview("");
    setSelected("");
    setStep(0);
  }
  function resetAll() {
    setTask(null);
    setPreview("");
    setConsent(false);
    setSelected("");
    setResultSignal("");
    setFeedbackStatus("idle");
    setCopied(false);
    setPreferences(initial);
    setStep(0);
    setError("");
  }
  async function chooseVariant(variantId: string) {
    setSelected(variantId);
    setResultSignal("");
    setFeedbackStatus("idle");
    setTask((current) =>
      current ? { ...current, selectedVariantId: variantId } : current,
    );
    if (task)
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskId: task.id, variantId, helpful: true }),
      });
  }
  async function cancelGeneration() {
    if (!task) return;
    const response = await fetch(`/api/design-tasks/${task.id}/cancel`, {
      method: "POST",
    });
    if (response.ok) setTask({ ...task, status: "cancelled" });
    else
      setError(
        t(
          "Could not cancel the generation. Try again later.",
          "取消失败，请稍后重试。",
        ),
      );
  }
  async function retryGeneration() {
    if (!task) return;
    setLoading(true);
    setError("");
    const response = await fetch(`/api/design-tasks/${task.id}/retry`, {
      method: "POST",
    });
    if (response.ok)
      setTask({ ...task, status: "queued", errorCode: undefined });
    else {
      const failure = await response
        .json()
        .catch(() => ({ error: "RETRY_FAILED" }));
      setError(
        failure.error === "SOURCE_EXPIRED"
          ? t(
              "The source photo has expired. Upload it again.",
              "原照片已清理，请重新上传。",
            )
          : t(
              "Could not retry right now. Try again later.",
              "暂时无法重试，请稍后再试。",
            ),
      );
    }
    setLoading(false);
  }
  async function saveResultSignal() {
    if (!task || !selected || !resultSignal) return;
    setFeedbackStatus("saving");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          taskId: task.id,
          variantId: selected,
          helpful: resultSignal !== "预览不可信",
          issue: resultSignal,
        }),
      });
      setFeedbackStatus(response.ok ? "saved" : "error");
    } catch {
      setFeedbackStatus("error");
    }
  }
  async function copySalonCard() {
    const variant = task?.variants.find((item) => item.id === selected);
    if (!variant) return;
    const text = isZh
      ? `发型沟通卡\n意向发型：${styleName(variant.template)}\n核心诉求：${goalLabels[preferences.goal]}\n原生发质：${textureLabels[preferences.texture]}\n发量与粗细：${densityLabels[preferences.density]}\n脸型：${faceShapeLabels[preferences.faceShape]}\n刘海 / 分缝：${fringeLabels[preferences.fringe]} / ${partingLabels[preferences.parting]}\n每日打理：${preferences.dailyMinutes}分钟\n是否接受烫染：${preferences.chemical ? "可以" : "只剪发"}\n实现条件：${styleConditions(variant.template)}\n备注：AI预览仅作设计参考，请结合真实发质、发量和头型确认。`
      : `Stylist reference card\nPreferred style: ${styleName(variant.template)}\nMain goal: ${goalLabels[preferences.goal]}\nNatural texture: ${textureLabels[preferences.texture]}\nHair density: ${densityLabels[preferences.density]}\nFace shape: ${faceShapeLabels[preferences.faceShape]}\nFringe / part: ${fringeLabels[preferences.fringe]} / ${partingLabels[preferences.parting]}\nDaily styling: ${preferences.dailyMinutes} minutes\nChemical treatment: ${preferences.chemical ? "Acceptable" : "Cut only"}\nConditions: ${styleConditions(variant.template)}\nNote: This AI preview is a design reference. Confirm feasibility with your stylist based on your hair texture, density, and head shape.`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
  }
  const progress = (step / 3) * 100;
  return (
    <main className="min-h-screen overflow-x-clip">
      <header className="site-header">
        <button
          onClick={() => setStep(0)}
          className="brand-lockup"
          aria-label={t("Back to home", "返回首页")}
        >
          <span className="brand-mark">
            <Scissors size={19} />
          </span>
          <span>
            <b>{t("HairMirror", "发型镜")}</b>
            <small>{t("AI hairstyle studio", "AI 发型设计")}</small>
          </span>
        </button>
        <nav className="site-nav" aria-label={t("Main navigation", "主导航")}>
          <a href="#examples">{t("Examples", "案例")}</a>
          <a href="#studio">{t("Try it", "开始体验")}</a>
          <Link href="/salon">{t("For stylists", "发型师工作台")}</Link>
          <Link href="/faq">{t("FAQ", "常见问题")}</Link>
        </nav>
        <div className="header-actions">
          <LocaleSwitcher locale={locale} />
          <Link href="/account" className="button-secondary button-compact">
            {t("Account", "我的")}
          </Link>
        </div>
      </header>
      <section className="page-container pb-16">
        {step === 0 && (
          <>
            <div className="hero-grid">
              <div className="hero-copy">
                <span className="hero-badge">
                  <Sparkles size={15} />
                  {t("AI hairstyle preview", "AI 发型预览")}
                </span>
                <h1>
                  {t("See your next haircut", "先看见下一款发型")}
                  <span>{t("before the first snip.", "再决定怎么剪。")}</span>
                </h1>
              </div>
              <div className="hero-intro">
                <p>
                  {t(
                    "Upload one photo and compare three realistic hairstyle directions, complete with upkeep notes for your stylist.",
                    "上传一张照片，比较三种贴近现实的发型方向，并获得可直接交给发型师的打理说明。",
                  )}
                </p>
                <div className="hero-actions">
                  <a href="#studio" className="button-primary">
                    {t("Start a free consultation", "免费开始一次咨询")}
                    <ArrowRight size={18} />
                  </a>
                  <Link href="/salon" className="button-secondary">
                    {t("For stylists: create a client consultation", "发型师：创建客户咨询")}
                  </Link>
                </div>
                <ul className="hero-proof">
                  <li><Check size={16} />{t("No payment during the pilot", "试用阶段无需付款")}</li>
                  <li><Check size={16} />{t("About one minute", "约一分钟")}</li>
                  <li><ShieldCheck size={16} />{t("Delete anytime", "随时删除")}</li>
                </ul>
              </div>
              <div id="examples" className="hero-showcase">
                <HomeShowcase locale={locale} />
              </div>
            </div>
            <div className="process-strip" aria-label={t("How it works", "使用步骤")}>
              <span><b>01</b>{t("Upload a clear photo", "上传清晰照片")}</span>
              <span><b>02</b>{t("Set your preferences", "选择实际条件")}</span>
              <span><b>03</b>{t("Compare and save", "比较并保存方案")}</span>
            </div>
          </>
        )}

        <section id="studio" className="studio-section" aria-labelledby="studio-heading">
          <div className="studio-heading">
            <div>
              <p className="eyebrow">{t("Hairstyle studio", "发型设计台")}</p>
              <h2 id="studio-heading">{t("Create your consultation", "创建你的发型咨询")}</h2>
            </div>
            <div className="step-meta">
              <span>{t("Step", "步骤")} {Math.min(step + 1, 4)} / 4</span>
              <strong>
                {(isZh
                  ? ["上传照片", "选择实际条件", "确认生成", "比较结果"]
                  : ["Upload photo", "Preferences", "Confirm", "Compare"])[step]}
              </strong>
            </div>
          </div>
          <div className="progress-track" aria-hidden>
            <div style={{ width: `${Math.max(8, progress)}%` }} />
          </div>

        {step === 3 && task?.status === "completed" && (
          <div className="mb-3 flex justify-end">
            <button
              disabled={loading}
              onClick={generate}
              className="flex items-center gap-2 rounded-full border border-[#1f6b5c] bg-white/75 px-4 py-2 text-sm text-[#1f6b5c] disabled:opacity-50"
            >
              <Sparkles size={15} />
              {loading
                ? t("Redesigning", "正在重新设计")
                : t("Try new styles", "换一批方案")}
            </button>
          </div>
        )}
        <div className="studio-panel">
          {step === 0 && (
            <div className="grid min-h-[530px] lg:grid-cols-2">
              <div className="flex flex-col justify-center p-7 md:p-12">
                <p className="text-sm font-semibold text-[#1f6b5c]">
                  01 · {t("Upload photo", "上传照片")}
                </p>
                <h2 className="mt-2 text-3xl font-semibold">
                  {t(
                    "Start with a clear, front-facing photo",
                    "从一张清晰正脸照开始",
                  )}
                </h2>
                <p className="mt-4 leading-7 text-[#6f7773]">
                  {t(
                    "Keep your forehead and hairline visible. Avoid filters, hats, and obstructions.",
                    "露出额头和发际线，不要使用美颜、帽子或遮挡。",
                  )}
                </p>
                <div className="mt-5 rounded-2xl bg-[#edf3ef] p-4 text-sm leading-6 text-[#245448]">
                  <b className="flex items-center gap-2">
                    <ShieldCheck size={17} />
                    {t(
                      "Your photo is used only for hairstyle generation",
                      "照片仅用于生成发型预览",
                    )}
                  </b>
                </div>
                <ul className="mt-5 grid gap-3 text-sm text-[#46504c]">
                  <li className="flex gap-2">
                    <Check className="text-[#1f6b5c]" size={18} />
                    {t("One person, even lighting", "单人、光线均匀")}
                  </li>
                  <li className="flex gap-2">
                    <Check className="text-[#1f6b5c]" size={18} />
                    {t(
                      "Face and current hair clearly visible",
                      "五官与当前头发清楚",
                    )}
                  </li>
                </ul>
              </div>
              <div className="m-5 flex min-h-[420px] items-center justify-center rounded-[1.5rem] bg-[#e8ece8] p-5">
                <input
                  ref={inputRef}
                  className="sr-only"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="user"
                  onChange={handleFile}
                />
                {preview ? (
                  <div className="relative h-full min-h-[380px] w-full overflow-hidden rounded-2xl bg-white">
                    <Image
                      src={preview}
                      alt={t("Uploaded photo", "待分析的用户照片")}
                      fill
                      unoptimized
                      className="object-contain"
                    />
                    <button
                      onClick={openPhotoPicker}
                      className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white px-4 py-2 text-sm shadow"
                    >
                      {t("Change photo", "更换照片")}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={openPhotoPicker}
                    className="grid min-h-[340px] w-full place-items-center rounded-2xl border-2 border-dashed border-[#aeb9b3] bg-white/55 p-8 text-center hover:bg-white"
                  >
                    <span>
                      <ImagePlus
                        className="mx-auto mb-4 text-[#1f6b5c]"
                        size={42}
                      />
                      <b className="block text-lg">
                        {t("Take or choose a photo", "拍照或选择照片")}
                      </b>
                      <small className="mt-2 block text-[#6f7773]">
                        {t(
                          "Use your phone camera or photo library",
                          "手机可直接调用前置相机",
                        )}
                      </small>
                      <small className="mt-1 block text-[#6f7773]">
                        {t(
                          "JPG, PNG, or WebP · Up to 8 MB",
                          "JPG、PNG、WebP · 最大 8MB",
                        )}
                      </small>
                      <span className="mt-5 grid grid-cols-3 gap-2 text-xs text-[#52605a]">
                        <i className="rounded-lg bg-white px-2 py-2 not-italic">
                          {t("Show hairline", "露出额头")}
                        </i>
                        <i className="rounded-lg bg-white px-2 py-2 not-italic">
                          {t("Face camera", "平视镜头")}
                        </i>
                        <i className="rounded-lg bg-white px-2 py-2 not-italic">
                          {t("Even light", "光线均匀")}
                        </i>
                      </span>
                    </span>
                  </button>
                )}
              </div>
              <div className="border-t border-[#dce1dc] p-5 lg:col-span-2">
                <label className="flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-1 size-4 accent-[#1f6b5c]"
                  />
                  <span>
                    {t(
                      "I have the right to use this photo and consent to processing by HairMirror and its current image provider. Results are retained for 30 days and can be deleted at any time.",
                      "我确认拥有照片使用权，并同意系统及当前图像服务商处理照片。生成结果默认保留 30 天，可随时删除。",
                    )}
                    <Link href="/privacy" className="ml-1 inline-flex min-h-11 items-center underline">
                      {t("Privacy Policy", "查看隐私政策")}
                    </Link>
                  </span>
                </label>
                {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                <div className="mt-4 flex justify-end">
                  <button
                    disabled={!preview || !consent}
                    onClick={() => setStep(1)}
                    className="flex items-center gap-2 rounded-full bg-[#1f6b5c] px-6 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {t("Continue", "下一步")} <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="p-7 md:p-12">
              <p className="text-sm font-semibold text-[#1f6b5c]">
                02 · {t("Preferences", "实际条件")}
              </p>
              <h2 className="mt-2 text-3xl font-semibold">
                {t("What would you like to change?", "你希望这次改变什么？")}
              </h2>
              <div className="mt-9 grid gap-7 md:grid-cols-2">
                <Field title={t("Style expression", "风格表达")}>
                  <Choice
                    options={[
                      ["neutral", t("No preference", "不限定")],
                      ["masculine", t("Sharper", "偏利落")],
                      ["feminine", t("Softer", "偏柔和")],
                    ]}
                    value={preferences.audience}
                    onChange={(v) =>
                      setPreferences({
                        ...preferences,
                        audience: v as DesignPreferences["audience"],
                      })
                    }
                  />
                </Field>
                <Field title={t("Current hair length", "当前发长")}>
                  <Choice
                    options={lengths.map((x) => [x.value, x.label])}
                    value={preferences.currentLength}
                    onChange={(v) =>
                      setPreferences({
                        ...preferences,
                        currentLength: v as HairLength,
                      })
                    }
                  />
                </Field>
                <Field title={t("Target hair length", "目标发长")}>
                  <Choice
                    options={lengths.map((x) => [x.value, x.label])}
                    value={preferences.targetLength}
                    onChange={(v) =>
                      setPreferences({
                        ...preferences,
                        targetLength: v as HairLength,
                      })
                    }
                  />
                </Field>
                <Field title={t("Main goal", "核心诉求")}>
                  <select
                    value={preferences.goal}
                    onChange={(e) =>
                      setPreferences({
                        ...preferences,
                        goal: e.target.value as HairGoal,
                      })
                    }
                    className="w-full rounded-xl border border-[#cfd7d2] bg-white px-4 py-3"
                  >
                    {Object.entries(goalLabels).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field title={t("Natural hair texture", "原生发质")}>
                  <Choice
                    options={Object.entries(textureLabels)}
                    value={preferences.texture}
                    onChange={(v) =>
                      setPreferences({
                        ...preferences,
                        texture: v as DesignPreferences["texture"],
                      })
                    }
                  />
                </Field>
                <Field title={t("Hair density", "发量与粗细")}>
                  <Choice
                    options={Object.entries(densityLabels)}
                    value={preferences.density}
                    onChange={(v) =>
                      setPreferences({
                        ...preferences,
                        density: v as DesignPreferences["density"],
                      })
                    }
                  />
                </Field>
                <Field title={t("Face shape", "脸型")}>
                  <select
                    value={preferences.faceShape}
                    onChange={(event) =>
                      setPreferences({
                        ...preferences,
                        faceShape: event.target
                          .value as DesignPreferences["faceShape"],
                      })
                    }
                    className="w-full rounded-xl border border-[#cfd7d2] bg-white px-4 py-3"
                  >
                    {Object.entries(faceShapeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field title={t("Fringe preference", "刘海偏好")}>
                  <select
                    value={preferences.fringe}
                    onChange={(event) =>
                      setPreferences({
                        ...preferences,
                        fringe: event.target.value as DesignPreferences["fringe"],
                      })
                    }
                    className="w-full rounded-xl border border-[#cfd7d2] bg-white px-4 py-3"
                  >
                    {Object.entries(fringeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field title={t("Parting preference", "分缝偏好")}>
                  <Choice
                    options={Object.entries(partingLabels)}
                    value={preferences.parting}
                    onChange={(v) =>
                      setPreferences({
                        ...preferences,
                        parting: v as DesignPreferences["parting"],
                      })
                    }
                  />
                </Field>
                <Field title={t("Chemical treatment", "是否接受烫染")}>
                  <Choice
                    options={[
                      ["false", t("Cut only", "只剪发")],
                      ["true", t("Perm or color is OK", "可以烫染")],
                    ]}
                    value={String(preferences.chemical)}
                    onChange={(v) =>
                      setPreferences({ ...preferences, chemical: v === "true" })
                    }
                  />
                </Field>
                <Field
                  title={t(
                    `${preferences.dailyMinutes} minutes of daily styling`,
                    `每天愿意打理 ${preferences.dailyMinutes} 分钟`,
                  )}
                >
                  <input
                    aria-label={t("Daily styling time", "每日打理时间")}
                    type="range"
                    min="0"
                    max="30"
                    step="5"
                    value={preferences.dailyMinutes}
                    onChange={(e) =>
                      setPreferences({
                        ...preferences,
                        dailyMinutes: Number(e.target.value),
                      })
                    }
                    className="w-full accent-[#1f6b5c]"
                  />
                </Field>
              </div>
              <Nav
                onBack={() => setStep(0)}
                onNext={() => setStep(2)}
                backLabel={t("Back", "上一步")}
                nextLabel={t("Confirm preferences", "确认条件")}
              />
            </div>
          )}

          {step === 2 && (
            <div className="grid min-h-[520px] lg:grid-cols-[.8fr_1.2fr]">
              <div className="relative min-h-[340px] bg-[#e8ece8]">
                <Image
                  src={preview}
                  alt={t("Original photo", "用户原始照片")}
                  fill
                  unoptimized
                  className="object-contain"
                />
              </div>
              <div className="flex flex-col justify-center p-7 md:p-12">
                <p className="text-sm font-semibold text-[#1f6b5c]">
                  03 · {t("Confirm", "确认生成")}
                </p>
                <h2 className="mt-2 text-3xl font-semibold">
                  {t(
                    "Ready to create three hairstyle directions",
                    "准备生成三种发型方向",
                  )}
                </h2>
                <div className="mt-7 grid gap-3 text-sm">
                  <Summary
                    label={t("Goal", "目标")}
                    value={goalLabels[preferences.goal]}
                  />
                  <Summary
                    label={t("Length", "发长")}
                    value={
                      lengths.find((x) => x.value === preferences.targetLength)
                        ?.label || ""
                    }
                  />
                  <Summary
                    label={t("Treatment", "烫染")}
                    value={
                      preferences.chemical
                        ? t("Allowed", "可以接受")
                        : t("Cut only", "只考虑剪发")
                    }
                  />
                  <Summary
                    label={t("Hair", "发质与发量")}
                    value={`${textureLabels[preferences.texture]} · ${densityLabels[preferences.density]}`}
                  />
                  <Summary
                    label={t("Face shape", "脸型")}
                    value={faceShapeLabels[preferences.faceShape]}
                  />
                  <Summary
                    label={t("Fringe / part", "刘海 / 分缝")}
                    value={`${fringeLabels[preferences.fringe]} · ${partingLabels[preferences.parting]}`}
                  />
                  <Summary
                    label={t("Styling time", "打理时间")}
                    value={t(
                      `${preferences.dailyMinutes} min/day`,
                      `${preferences.dailyMinutes} 分钟/天`,
                    )}
                  />
                </div>
                {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
                {errorAction && (
                  <Link
                    href="/login?next=%2F%23studio"
                    className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--brand)] underline"
                  >
                    {t("Sign in or create an account", "登录或创建账号")}
                  </Link>
                )}
                <div className="mt-7 flex flex-wrap justify-between gap-3">
                  <button
                    onClick={() => setStep(1)}
                    className="flex items-center gap-2 rounded-full border border-[#cfd7d2] px-5 py-3"
                  >
                    <ArrowLeft size={17} />
                    {t("Edit preferences", "修改条件")}
                  </button>
                  <button
                    disabled={loading}
                    onClick={generate}
                    className="flex min-w-40 items-center justify-center gap-2 rounded-full bg-[#1f6b5c] px-6 py-3 font-medium text-white disabled:opacity-60"
                  >
                    {loading ? (
                      <>
                        <LoaderCircle className="animate-spin" size={18} />
                        {t("Creating", "正在设计")}
                      </>
                    ) : (
                      <>
                        <Sparkles size={18} />
                        {t("Generate styles", "生成方案")}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 3 &&
            task &&
            ["queued", "processing"].includes(task.status) && (
              <div className="grid min-h-[520px] place-items-center p-8 text-center">
                <div>
                  <LoaderCircle
                    className="mx-auto animate-spin text-[#1f6b5c]"
                    size={44}
                  />
                  <h2 className="mt-5 text-2xl font-semibold">
                    {t("Creating three hairstyle previews", "正在生成三种发型")}
                  </h2>
                  <p className="mt-2 text-sm text-[#6f7773]">
                    {t(
                      "You can close this page and return later from your account.",
                      "页面可以暂时关闭，稍后从“我的发型方案”继续查看。",
                    )}
                  </p>
                  <button
                    onClick={cancelGeneration}
                    className="mt-6 rounded-full border border-[#cfd7d2] px-5 py-2.5 text-sm"
                  >
                    {t("Cancel generation", "取消生成")}
                  </button>
                </div>
              </div>
            )}
          {step === 3 &&
            task &&
            ["failed", "cancelled"].includes(task.status) && (
              <div className="grid min-h-[520px] place-items-center p-8 text-center">
                <div>
                  <h2 className="text-2xl font-semibold">
                    {task.status === "cancelled"
                      ? t("Generation cancelled", "生成已取消")
                      : t("Generation was unsuccessful", "这次没有生成成功")}
                  </h2>
                  <p className="mt-2 text-sm text-[#6f7773]">
                    {task.status === "failed"
                      ? t(
                          "Retry now. If the source photo has expired, upload it again.",
                          "可以直接重试；如果原照片已过期，需要重新上传。",
                        )
                      : t(
                          "This task will not incur further usage.",
                          "本次任务不会继续产生费用。",
                        )}
                  </p>
                  {error && (
                    <p className="mt-3 text-sm text-red-600">{error}</p>
                  )}
                  <div className="mt-6 flex justify-center gap-3">
                    {task.status === "failed" && (
                      <button
                        disabled={loading}
                        onClick={retryGeneration}
                        className="rounded-full bg-[#1f6b5c] px-5 py-2.5 text-sm text-white"
                      >
                        {t("Retry", "重新生成")}
                      </button>
                    )}
                    <button
                      onClick={removeTask}
                      className="rounded-full border border-[#cfd7d2] px-5 py-2.5 text-sm"
                    >
                      {t("Delete record", "删除记录")}
                    </button>
                  </div>
                </div>
              </div>
            )}
          {step === 3 && task?.status === "completed" && (
            <div className="p-6 md:p-10">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[#1f6b5c]">
                    04 · {t("Compare results", "比较结果")}
                  </p>
                  <h2 className="mt-2 text-3xl font-semibold">
                    {t(
                      "Choose the style that feels most like you",
                      "选一款最像你的",
                    )}
                  </h2>
                  <p className="mt-2 text-[#6f7773]">
                    {t(
                      "Select one to create a reference card for your stylist.",
                      "选中后可以生成发型师沟通卡。",
                    )}
                  </p>
                </div>
                <button
                  onClick={removeTask}
                  className="flex items-center gap-2 text-sm text-[#6f7773] hover:text-red-700"
                >
                  <Trash2 size={16} />
                  {t("Delete this record", "删除本次记录")}
                </button>
              </div>
              <div className="mt-8 grid gap-5 lg:grid-cols-3">
                {task.variants.map((v) => {
                  const resultImage = v.resultImageUrl;
                  return (
                    <article
                      key={v.id}
                      className={`overflow-hidden rounded-2xl border-2 bg-white transition ${selected === v.id ? "border-[#1f6b5c] shadow-xl" : "border-transparent shadow-sm"}`}
                    >
                      <div
                        className={`${resultImage ? "" : "hair-overlay"} relative aspect-[4/5] overflow-hidden bg-[#e8ece8]`}
                        data-style={v.template.visual}
                        style={
                          {
                            "--hair-color": v.template.color,
                          } as React.CSSProperties
                        }
                      >
                        {resultImage ? (
                          <ProtectedResultImage
                            src={resultImage}
                            alt={t(
                              `${styleName(v.template)} preview`,
                              `${v.template.name}预览`,
                            )}
                            errorLabel={t(
                              "The preview could not be loaded.",
                              "预览图暂时无法加载。",
                            )}
                            retryLabel={t("Reload image", "重新加载")}
                          />
                        ) : (
                          <Image
                            src={preview}
                            alt={t(
                              `${styleName(v.template)} preview`,
                              `${v.template.name}预览`,
                            )}
                            fill
                            unoptimized
                            className="object-cover"
                          />
                        )}
                      </div>
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-xl font-semibold">
                            {styleName(v.template)}
                          </h3>
                          <span className="shrink-0 rounded-full bg-[#edf3ef] px-2 py-1 text-xs text-[#1f6b5c]">
                            {t("Maintenance", "打理")}{" "}
                            {maintenanceLabel(v.template.maintenance)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-[#6f7773]">
                          {t(
                            "Matches your selected goal and target length.",
                            v.reason,
                          )}
                        </p>
                        <p className="mt-3 text-sm">
                          <b>{t("Works best when: ", "适合条件：")}</b>
                          {styleConditions(v.template)}
                        </p>
                        <button
                          onClick={() => chooseVariant(v.id)}
                          className={`mt-5 w-full rounded-xl py-3 font-medium ${selected === v.id ? "bg-[#1f6b5c] text-white" : "border border-[#cfd7d2] hover:bg-[#f5f7f5]"}`}
                        >
                          {selected === v.id
                            ? t("Selected", "已选定")
                            : t("Choose this style", "就选这款")}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
              {selected && (
                <div className="mt-7 rounded-2xl bg-[#173f37] p-5 text-white">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <b>{t("Style selected", "已选好发型")}</b>
                      <p className="mt-1 text-sm text-white/70">
                        {t(
                          "Share the reference card with your stylist to explain the direction clearly.",
                          "带着沟通卡去理发，减少表达偏差。",
                        )}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={copySalonCard}
                        className="rounded-full bg-[#e5b56d] px-5 py-2.5 font-medium text-[#173f37]"
                      >
                        {copied
                          ? t("Reference card copied", "沟通卡已复制")
                          : t(
                              "Copy stylist reference card",
                              "复制发型师沟通卡",
                            )}
                      </button>
                      <button
                        onClick={resetAll}
                        className="rounded-full bg-white px-5 py-2.5 font-medium text-[#173f37]"
                      >
                        {t("Start another design", "再设计一次")}
                      </button>
                    </div>
                  </div>
                  <div className="mt-5 border-t border-white/15 pt-4">
                    <p className="text-sm text-white/70">
                      {t(
                        "How does this result feel?",
                        "这个结果最接近哪种感受？",
                      )}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {feedbackSignals.map((signal) => (
                        <button
                          key={signal.value}
                          type="button"
                          onClick={() => {
                            setResultSignal(signal.value);
                            setFeedbackStatus("idle");
                          }}
                          className={`rounded-full px-4 py-2 text-sm ${resultSignal === signal.value ? "bg-[#e5b56d] text-[#173f37]" : "bg-white/10 hover:bg-white/15"}`}
                        >
                          {signal.label}
                        </button>
                      ))}
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={saveResultSignal}
                        disabled={!resultSignal || feedbackStatus === "saving"}
                        className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#173f37] hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                      >
                        {feedbackStatus === "saving"
                          ? t("Saving…", "保存中…")
                          : t("Save feedback", "保存反馈")}
                      </button>
                      {feedbackStatus === "saved" && (
                        <span className="flex items-center gap-1.5 text-sm text-emerald-200">
                          <Check size={16} />
                          {t("Feedback saved", "反馈已保存")}
                        </span>
                      )}
                      {feedbackStatus === "error" && (
                        <span className="text-sm text-red-200">
                          {t(
                            "Could not save. Please try again.",
                            "保存失败，请重试。",
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        {step === 0 && recentTasks.length > 0 && (
          <section className="mt-8 rounded-3xl border border-white bg-white/65 p-6">
            <div>
              <p className="text-sm font-semibold text-[#1f6b5c]">
                {t("Recent designs", "最近设计")}
              </p>
              <h2 className="mt-1 text-2xl font-semibold">
                {t("My hairstyle previews", "我的发型方案")}
              </h2>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {recentTasks.slice(0, 3).map((item) => (
                <button
                  type="button"
                  onClick={() => {
                    setTask(item);
                    setPreferences(item.preferences);
                    setSelected(item.selectedVariantId ?? "");
                    setResultSignal("");
                    setFeedbackStatus("idle");
                    setStep(3);
                  }}
                  key={item.id}
                  className="rounded-2xl bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <b>{goalLabels[item.preferences.goal]}</b>
                    <span className="rounded-full bg-[#edf3ef] px-2 py-1 text-xs text-[#1f6b5c]">
                      {item.status === "completed"
                        ? t(
                            `${item.variants.length} options`,
                            `${item.variants.length} 个方案`,
                          )
                        : item.status === "failed"
                          ? t("Failed", "生成失败")
                          : item.status === "cancelled"
                            ? t("Cancelled", "已取消")
                            : t("Generating", "生成中")}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-[#6f7773]">
                    {new Date(item.createdAt).toLocaleString(locale)}
                  </p>
                </button>
              ))}
            </div>
          </section>
        )}
        </section>
        {step === 0 && <FeedbackSection locale={locale} />}
        <p className="mx-auto mt-7 max-w-3xl text-center text-xs leading-5 text-[#7c837f]">
          {t(
            "AI previews are for hairstyle planning only. Confirm the final cut with a professional based on your hair texture and density.",
            "预览仅作发型参考，实际效果请结合发质和发量确认。",
          )}
          <br />
          <Link href="/faq" className="underline">{t("FAQ", "常见问题")}</Link>
          <span className="mx-2">·</span>
          <Link href="/privacy" className="underline">{t("Privacy", "隐私政策")}</Link>
          <span className="mx-2">·</span>
          <Link href="/terms" className="underline">{t("Terms", "服务条款")}</Link>
          <span className="mx-2">·</span>
          <Link href="/refunds" className="underline">{t("Refunds", "退款政策")}</Link>
        </p>
      </section>
    </main>
  );
}

function Field({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset>
      <legend className="mb-3 font-medium">{title}</legend>
      {children}
    </fieldset>
  );
}
function Choice({
  options,
  value,
  onChange,
}: {
  options: string[][];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map(([v, l]) => (
        <button
          type="button"
          key={v}
          onClick={() => onChange(v)}
          className={`rounded-xl border px-3 py-3 text-sm ${value === v ? "border-[#1f6b5c] bg-[#edf3ef] font-medium text-[#1f6b5c]" : "border-[#cfd7d2] bg-white"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
function Nav({
  onBack,
  onNext,
  backLabel,
  nextLabel,
}: {
  onBack: () => void;
  onNext: () => void;
  backLabel: string;
  nextLabel: string;
}) {
  return (
    <div className="mt-10 flex justify-between">
      <button
        onClick={onBack}
        className="flex items-center gap-2 rounded-full border border-[#cfd7d2] px-5 py-3"
      >
        <ArrowLeft size={17} />
        {backLabel}
      </button>
      <button
        onClick={onNext}
        className="flex items-center gap-2 rounded-full bg-[#1f6b5c] px-6 py-3 font-medium text-white"
      >
        {nextLabel}
        <ArrowRight size={17} />
      </button>
    </div>
  );
}
function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between rounded-xl bg-[#f2f4f1] px-4 py-3">
      <span className="text-[#6f7773]">{label}</span>
      <b>{value}</b>
    </div>
  );
}
