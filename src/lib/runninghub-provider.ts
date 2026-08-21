import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isTemplateCompatibleWithTreatmentMode } from "./catalog";
import {
  normalizeDesignPreferences,
  targetHairColorText,
  type DesignPreferences,
  type HairstyleTemplate,
} from "./types";
import { db } from "./database";
import { removeAssetsForTask } from "./asset-retention";

type RunningHubResponse = {
  taskId?: string;
  status?: string;
  errorCode?: string;
  errorMessage?: string;
  results?: Array<{ url?: string; outputType?: string }> | null;
  usage?: {
    consumeMoney?: string | null;
    thirdPartyConsumeMoney?: string | null;
  };
};
type RunningHubConfig = {
  endpoint: string;
  apiKey: string;
  timeoutMs: number;
  costPerImageMicros: number;
};
type RunningHubContext = {
  taskId: string;
  ownerSessionId: string;
  userId: string | null;
  preferences: DesignPreferences;
  imageDataUrl: string;
};

const MAX_PROVIDER_ERROR_MESSAGE_LENGTH = 500;

function cleanErrorCode(value: unknown, fallback: string) {
  const code = String(value ?? "").trim();
  return (code || fallback).slice(0, 100);
}

function cleanErrorMessage(value: unknown, fallback: string) {
  let message = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED]")
    .replace(
      /data:[^,;\s]+;base64,[A-Za-z0-9+/=]+/gi,
      "[IMAGE_REDACTED]",
    );
  if (!message) message = fallback;
  return message.length > MAX_PROVIDER_ERROR_MESSAGE_LENGTH
    ? `${message.slice(0, MAX_PROVIDER_ERROR_MESSAGE_LENGTH - 1)}…`
    : message;
}

function providerUsageCost(data: RunningHubResponse) {
  return (
    moneyToMicros(data.usage?.consumeMoney) +
    moneyToMicros(data.usage?.thirdPartyConsumeMoney)
  );
}

export class RunningHubGenerationError extends Error {
  errorCode: string;
  errorMessage: string;
  actualCostMicros: number;
  constructor(
    errorCode: string,
    errorMessage: string,
    actualCostMicros: number,
  ) {
    const safeCode = cleanErrorCode(errorCode, "RUNNINGHUB_FAILED");
    const safeMessage = cleanErrorMessage(errorMessage, "供应商未提供具体错误信息");
    super(`${safeCode}: ${safeMessage}`);
    this.name = "RunningHubGenerationError";
    this.errorCode = safeCode;
    this.errorMessage = safeMessage;
    this.actualCostMicros = actualCostMicros;
  }
}

function hairColorInstructions(preferences: DesignPreferences) {
  const target = targetHairColorText(preferences);
  const preserveZh =
    "除非用户明确指定目标发色，否则必须严格保持原图头发颜色。不得染色、漂色、挑染、改变明度、改变色相或改变冷暖色调。";
  const preserveEn =
    "Preserve the exact original hair color unless the user explicitly selected a target hair color. Do not dye, bleach, highlight, recolor, lighten, darken, desaturate, or change the hair tone.";
  if (!target) {
    return {
      opening: `${preserveZh} 未提供有效的targetHairColor时不得改变发色。 ${preserveEn} If targetHairColor is missing or invalid, do not change the hair color.`,
      ending: `最终发色约束：保持原图发色，不得猜测或自行改变。 Final hair-color constraint: preserve the exact original hair color; never guess or alter it.`,
    };
  }
  return {
    opening: `${preserveZh} 本次用户已明确选择目标发色。将发色修改为用户指定的${target}，不得自行选择其他颜色。 ${preserveEn} The user explicitly selected a target hair color for this request. Change the hair color to the user-specified ${target} only; do not choose any other color.`,
    ending: `最终发色约束：只能使用用户指定的${target}，不得出现其他发色、挑染或渐变。 Final hair-color constraint: use only the user-specified ${target}; do not add any other color, highlights, or gradients.`,
  };
}

export function buildRunningHubPrompt(
  template: HairstyleTemplate,
  preferences: DesignPreferences,
) {
  const normalized = normalizeDesignPreferences(preferences);
  const texture = {
    straight: "直发",
    wavy: "自然波浪",
    curly: "卷发",
    coily: "紧密卷发",
  }[normalized.texture];
  const density = { fine: "偏少或细软", medium: "中等", thick: "浓密或粗硬" }[
    normalized.density
  ];
  const faceShape = {
    auto: "根据原图判断脸型",
    oval: "椭圆脸",
    round: "圆脸",
    square: "方脸",
    heart: "心形脸",
    long: "长脸",
  }[normalized.faceShape];
  const fringe = {
    open: "刘海不限，以适配脸型为准",
    avoid: "不要刘海，保持额头开放",
    soft: "使用轻薄或八字刘海",
    full: "使用完整、有明确轮廓的刘海",
  }[normalized.fringe];
  const parting = {
    auto: "分缝方向根据原图与脸型自动选择",
    center: "采用中分",
    side: "采用侧分",
  }[normalized.parting];
  const treatment = normalized.treatmentMode === "perm_allowed"
    ? "允许改变卷度或使用现实可实现的烫发，但不得因为允许烫发而改变发色"
    : "只能通过剪发和日常造型实现，不得烫发或依赖卷发工具";
  const treatmentEn = normalized.treatmentMode === "perm_allowed"
    ? "Perming may be used to change curl pattern when needed, but permission to perm never permits changing hair color."
    : "Use cutting and ordinary styling only; do not perm or rely on curling tools.";
  const color = hairColorInstructions(normalized);
  return `${color.opening} 这是严格的局部头发编辑任务，不是重新生成人像。只允许修改头发区域及发丝边缘，发型改为“${template.name}”，目标长度必须是${template.length === "long" ? "长发，发梢到胸口附近" : template.length === "medium" ? "中发，发梢在下颌至锁骨之间" : "短发，发梢不超过下颌"}。用户真实条件：原生发质${texture}，发量与粗细${density}，${faceShape}，${fringe}，${parting}，${treatment}，每天最多打理${normalized.dailyMinutes}分钟。English treatment rule: ${treatmentEn} ${template.description}${template.conditions}。发型模板只能改变长度、层次、轮廓、刘海、分缝、卷度和打理方式，不得覆盖全局用户偏好。必须优先适配这些真实条件，不得为了套用模板而改变脸型或捏造不现实的发量。原图人物必须像素级保持同一身份：脸型、额头、眉毛、眼睛、鼻子、嘴唇、牙齿、耳朵、肤色、皮肤纹理、痣、皱纹、表情和头部角度不得变化；眼镜、服装、肩颈、构图、背景、曝光和光线不得变化。禁止美颜、磨皮、瘦脸、放大眼睛、改变妆容、年龄、性别或种族；禁止重新绘制面部和身体。发际线自然，发丝真实，效果必须能由现实理发实现。不要添加文字、边框、水印或其他人物。输出真实摄影风格的单张竖版人像。${color.ending}`;
}

async function requestJson(url: string, init: RequestInit, timeoutMs: number) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = (await response
    .json()
    .catch(() => null)) as RunningHubResponse | null;
  if (!data)
    throw new RunningHubGenerationError(
      `RUNNINGHUB_HTTP_${response.status}`,
      "RunningHub 返回了无法解析的响应",
      0,
    );
  if (!response.ok)
    throw new RunningHubGenerationError(
      data.errorCode || `RUNNINGHUB_HTTP_${response.status}`,
      data.errorMessage || `HTTP ${response.status}`,
      providerUsageCost(data),
    );
  return data;
}

async function submit(
  config: RunningHubConfig,
  imageDataUrl: string,
  prompt: string,
) {
  const data = await requestJson(
    config.endpoint,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        imageUrls: [imageDataUrl],
        prompt,
        aspectRatio: "4:5",
      }),
    },
    config.timeoutMs,
  );
  if (!data.taskId)
    throw new RunningHubGenerationError(
      data.errorCode || "RUNNINGHUB_SUBMIT_FAILED",
      data.errorMessage || "RunningHub 未返回任务 ID",
      providerUsageCost(data),
    );
  return data.taskId;
}

async function query(config: RunningHubConfig, taskId: string) {
  const queryUrl = new URL("/openapi/v2/query", config.endpoint).toString();
  return requestJson(
    queryUrl,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({ taskId }),
    },
    Math.min(config.timeoutMs, 30_000),
  );
}

async function waitForResult(config: RunningHubConfig, taskId: string) {
  const deadline = Date.now() + config.timeoutMs;
  while (Date.now() < deadline) {
    const data = await query(config, taskId);
    if (data.status === "SUCCESS") {
      const url = data.results?.find((result) => result.url)?.url;
      if (!url)
        throw new RunningHubGenerationError(
          "RUNNINGHUB_EMPTY_RESULT",
          "RunningHub 未返回结果图片",
          providerUsageCost(data),
        );
      return {
        url,
        costMicros: providerUsageCost(data),
      };
    }
    if (data.status === "FAILED")
      throw new RunningHubGenerationError(
        data.errorCode || "RUNNINGHUB_FAILED",
        data.errorMessage || "RunningHub 任务失败",
        providerUsageCost(data),
      );
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error("RUNNINGHUB_TIMEOUT");
}

function moneyToMicros(value: string | null | undefined) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount)
    ? Math.max(0, Math.round(amount * 1_000_000))
    : 0;
}

async function persistResult(remoteUrl: string, context: RunningHubContext) {
  const response = await fetch(remoteUrl, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error("RUNNINGHUB_RESULT_DOWNLOAD_FAILED");
  const mime =
    response.headers.get("content-type")?.split(";")[0] ?? "image/png";
  if (!["image/png", "image/jpeg", "image/webp"].includes(mime))
    throw new Error("RUNNINGHUB_RESULT_TYPE_INVALID");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 30 * 1024 * 1024)
    throw new Error("RUNNINGHUB_RESULT_TOO_LARGE");
  const extension = mime === "image/jpeg" ? "jpg" : mime.split("/")[1];
  const assetId = crypto.randomUUID();
  const directory =
    process.env.GENERATED_ASSETS_DIR ??
    join(/* turbopackIgnore: true */ process.cwd(), "data", "generated");
  mkdirSync(directory, { recursive: true });
  const path = join(
    /* turbopackIgnore: true */ directory,
    `${assetId}.${extension}`,
  );
  writeFileSync(path, bytes, { mode: 0o600 });
  db()
    .prepare(
      "INSERT INTO generated_assets(id,task_id,owner_session_id,user_id,file_path,mime_type,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?)",
    )
    .run(
      assetId,
      context.taskId,
      context.ownerSessionId,
      context.userId,
      path,
      mime,
      new Date().toISOString(),
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    );
  return `/api/generated-assets/${assetId}`;
}

export async function generateWithRunningHub(
  config: RunningHubConfig,
  templates: HairstyleTemplate[],
  context: RunningHubContext,
) {
  const normalizedPreferences = normalizeDesignPreferences(context.preferences);
  const conflictingTemplate = templates.find(
    (template) => !isTemplateCompatibleWithTreatmentMode(
      template,
      normalizedPreferences.treatmentMode,
    ),
  );
  if (conflictingTemplate)
    throw new RunningHubGenerationError(
      "TEMPLATE_CONFLICTS_WITH_PREFERENCE",
      "发型模板与用户选择的发型处理方式冲突",
      0,
    );
  const templateText = templates
    .map((template) => `${template.name} ${template.description} ${template.conditions}`)
    .join(" ");
  if (/染发|漂发|挑染|发色|\bdye\b|\bbleach\b|\bhighlight\b|\brecolor\b/i.test(templateText))
    throw new RunningHubGenerationError(
      "TEMPLATE_CONTAINS_COLOR_DIRECTIVE",
      "发型模板不得包含发色改变指令",
      0,
    );
  const settled = await Promise.allSettled(
    templates.map(async (template) => {
      const remoteTaskId = await submit(
        config,
        context.imageDataUrl,
        buildRunningHubPrompt(template, context.preferences),
      );
      const result = await waitForResult(config, remoteTaskId);
      let localUrl: string;
      try {
        localUrl = await persistResult(result.url, context);
      } catch {
        throw new RunningHubGenerationError(
          "RUNNINGHUB_RESULT_PERSIST_FAILED",
          "生成图片保存失败",
          result.costMicros,
        );
      }
      return {
        templateId: template.id,
        url: localUrl,
        costMicros: Math.max(
          result.costMicros,
          Math.max(0, config.costPerImageMicros),
        ),
      };
    }),
  );
  const outputs = settled.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
  const successfulCostMicros = outputs.reduce(
    (sum, output) => sum + output.costMicros,
    0,
  );
  const failedCostMicros = settled.reduce((sum, result) => {
    if (result.status !== "rejected") return sum;
    const reason = result.reason;
    return reason instanceof RunningHubGenerationError
      ? sum + Math.max(0, reason.actualCostMicros)
      : sum;
  }, 0);
  const actualCostMicros = successfulCostMicros + failedCostMicros;
  const failed = settled.find((result) => result.status === "rejected");
  if (failed) {
    removeAssetsForTask(
      context.taskId,
      process.env.GENERATED_ASSETS_DIR ??
        join(/* turbopackIgnore: true */ process.cwd(), "data", "generated"),
    );
    const reason = failed.reason;
    if (reason instanceof RunningHubGenerationError) {
      reason.actualCostMicros = actualCostMicros;
      throw reason;
    }
    throw new RunningHubGenerationError(
      "RUNNINGHUB_FAILED",
      reason instanceof Error ? reason.message : "RunningHub 任务失败",
      actualCostMicros,
    );
  }
  return {
    imageUrls: Object.fromEntries(
      outputs.map((output) => [output.templateId, output.url]),
    ),
    actualCostMicros,
  };
}
