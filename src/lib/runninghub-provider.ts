import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { DesignPreferences, HairstyleTemplate } from "./types";
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
type RunningHubConfig = { endpoint: string; apiKey: string; timeoutMs: number };
type RunningHubContext = {
  taskId: string;
  ownerSessionId: string;
  userId: string | null;
  preferences: DesignPreferences;
  imageDataUrl: string;
};

export class RunningHubGenerationError extends Error {
  actualCostMicros: number;
  constructor(message: string, actualCostMicros: number) {
    super(message);
    this.name = "RunningHubGenerationError";
    this.actualCostMicros = actualCostMicros;
  }
}

function hairstylePrompt(
  template: HairstyleTemplate,
  preferences: DesignPreferences,
) {
  const texture = {
    straight: "直发",
    wavy: "自然波浪",
    curly: "卷发",
    coily: "紧密卷发",
  }[preferences.texture];
  const density = { fine: "偏少或细软", medium: "中等", thick: "浓密或粗硬" }[
    preferences.density
  ];
  const faceShape = {
    auto: "根据原图判断脸型",
    oval: "椭圆脸",
    round: "圆脸",
    square: "方脸",
    heart: "心形脸",
    long: "长脸",
  }[preferences.faceShape];
  const fringe = {
    open: "刘海不限，以适配脸型为准",
    avoid: "不要刘海，保持额头开放",
    soft: "使用轻薄或八字刘海",
    full: "使用完整、有明确轮廓的刘海",
  }[preferences.fringe];
  const parting = {
    auto: "分缝方向根据原图与脸型自动选择",
    center: "采用中分",
    side: "采用侧分",
  }[preferences.parting];
  const treatment = preferences.chemical
    ? "可以使用现实可实现的烫发或染发效果"
    : "只能通过剪发和日常造型实现，不得依赖烫染";
  return `这是严格的局部头发编辑任务，不是重新生成人像。只允许修改头发区域及发丝边缘，发型改为“${template.name}”，目标长度必须是${template.length === "long" ? "长发，发梢到胸口附近" : template.length === "medium" ? "中发，发梢在下颌至锁骨之间" : "短发，发梢不超过下颌"}。用户真实条件：原生发质${texture}，发量与粗细${density}，${faceShape}，${fringe}，${parting}，${treatment}，每天最多打理${preferences.dailyMinutes}分钟。${template.description}${template.conditions}。必须优先适配这些真实条件，不得为了套用模板而改变脸型或捏造不现实的发量。原图人物必须像素级保持同一身份：脸型、额头、眉毛、眼睛、鼻子、嘴唇、牙齿、耳朵、肤色、皮肤纹理、痣、皱纹、表情和头部角度不得变化；眼镜、服装、肩颈、构图、背景、曝光和光线不得变化。禁止美颜、磨皮、瘦脸、放大眼睛、改变妆容、年龄、性别或种族；禁止重新绘制面部和身体。发际线自然，发丝真实，效果必须能由现实理发实现。不要添加文字、边框、水印或其他人物。输出真实摄影风格的单张竖版人像。`;
}

async function requestJson(url: string, init: RequestInit, timeoutMs: number) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = (await response
    .json()
    .catch(() => null)) as RunningHubResponse | null;
  if (!response.ok || !data)
    throw new Error(`RUNNINGHUB_HTTP_${response.status}`);
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
    throw new Error(data.errorCode || "RUNNINGHUB_SUBMIT_FAILED");
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
      if (!url) throw new Error("RUNNINGHUB_EMPTY_RESULT");
      return {
        url,
        costMicros:
          moneyToMicros(data.usage?.consumeMoney) +
          moneyToMicros(data.usage?.thirdPartyConsumeMoney),
      };
    }
    if (data.status === "FAILED")
      throw new Error(data.errorCode || "RUNNINGHUB_FAILED");
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
  const settled = await Promise.allSettled(
    templates.map(async (template) => {
      const remoteTaskId = await submit(
        config,
        context.imageDataUrl,
        hairstylePrompt(template, context.preferences),
      );
      const result = await waitForResult(config, remoteTaskId);
      const localUrl = await persistResult(result.url, context);
      return {
        templateId: template.id,
        url: localUrl,
        costMicros: result.costMicros,
      };
    }),
  );
  const outputs = settled.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
  const actualCostMicros = outputs.reduce(
    (sum, output) => sum + output.costMicros,
    0,
  );
  const failed = settled.find((result) => result.status === "rejected");
  if (failed) {
    removeAssetsForTask(
      context.taskId,
      process.env.GENERATED_ASSETS_DIR ??
        join(/* turbopackIgnore: true */ process.cwd(), "data", "generated"),
    );
    const reason = failed.reason;
    throw new RunningHubGenerationError(
      reason instanceof Error ? reason.message : "RUNNINGHUB_FAILED",
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
