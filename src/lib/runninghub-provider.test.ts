import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HAIRSTYLES, recommendTemplates } from "./catalog";
import {
  closeDatabaseForTest,
  db,
  RUNNINGHUB_INTERNATIONAL_ENDPOINT,
} from "./database";
import { generateWithRunningHub } from "./runninghub-provider";
import { DEFAULT_DESIGN_PREFERENCES } from "./types";

let directory = "";
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "hair-runninghub-"));
  process.env.SQLITE_PATH = join(directory, "test.db");
  process.env.GENERATED_ASSETS_DIR = join(directory, "generated");
});
afterEach(() => {
  vi.unstubAllGlobals();
  closeDatabaseForTest();
  delete process.env.SQLITE_PATH;
  delete process.env.GENERATED_ASSETS_DIR;
  rmSync(directory, { recursive: true, force: true });
});

describe("RunningHub adapter", () => {
  it("submits three tasks, queries results and persists protected assets", async () => {
    let submitted = 0;
    const prompts: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/openapi/v2/query")) {
          const taskId = JSON.parse(String(init?.body)).taskId;
          return Response.json({
            taskId,
            status: "SUCCESS",
            usage: { consumeMoney: "0.01", thirdPartyConsumeMoney: "0.02" },
            results: [
              {
                url: `https://images.example/${taskId}.png`,
                outputType: "png",
              },
            ],
          });
        }
        if (url.startsWith("https://images.example/"))
          return new Response(new Uint8Array([137, 80, 78, 71]), {
            status: 200,
            headers: { "content-type": "image/png" },
          });
        submitted += 1;
        prompts.push(String(JSON.parse(String(init?.body)).prompt));
        return Response.json({
          taskId: `rh-${submitted}`,
          status: "RUNNING",
          results: null,
        });
      }),
    );
    const result = await generateWithRunningHub(
      {
        endpoint: RUNNINGHUB_INTERNATIONAL_ENDPOINT,
        apiKey: "test-key",
        timeoutMs: 5000,
        costPerImageMicros: 15_000,
      },
      HAIRSTYLES.slice(0, 3),
      {
        taskId: crypto.randomUUID(),
        ownerSessionId: "test-session",
        userId: null,
        preferences: DEFAULT_DESIGN_PREFERENCES,
        imageDataUrl: "data:image/png;base64,iVBORw0KGgo=",
      },
    );
    expect(Object.keys(result.imageUrls)).toHaveLength(3);
    expect(
      Object.values(result.imageUrls).every((url) =>
        url.startsWith("/api/generated-assets/"),
      ),
    ).toBe(true);
    expect(result.actualCostMicros).toBe(90_000);
    expect(prompts).toHaveLength(3);
    expect(prompts[0]).toContain("原生发质直发");
    expect(prompts[0]).toContain("发量与粗细中等");
    expect(prompts[0]).toContain("只能通过剪发和日常造型实现");
    expect(prompts[0]).toContain("原图人物必须像素级保持同一身份");
    expect(prompts[0]).toContain("禁止美颜、磨皮、瘦脸、放大眼睛、改变妆容、年龄、性别或种族");
    expect(prompts[0]).toContain("背景、曝光和光线不得变化");
  });

  it.each([
    ["provider cost below the configured floor", { consumeMoney: "0.01" }, 45_000],
    ["provider cost missing", undefined, 45_000],
    ["provider cost above the configured floor", { consumeMoney: "0.02" }, 60_000],
  ])(
    "%s",
    async (_label, usage, expectedCostMicros) => {
      let submitted = 0;
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
          const url = String(input);
          if (url.endsWith("/openapi/v2/query")) {
            const taskId = JSON.parse(String(init?.body)).taskId;
            return Response.json({
              taskId,
              status: "SUCCESS",
              usage,
              results: [{ url: `https://images.example/${taskId}.png` }],
            });
          }
          if (url.startsWith("https://images.example/"))
            return new Response(new Uint8Array([137, 80, 78, 71]), {
              status: 200,
              headers: { "content-type": "image/png" },
            });
          submitted += 1;
          return Response.json({ taskId: `rh-floor-${submitted}` });
        }),
      );

      const result = await generateWithRunningHub(
        {
          endpoint: RUNNINGHUB_INTERNATIONAL_ENDPOINT,
          apiKey: "test-key",
          timeoutMs: 5000,
          costPerImageMicros: 15_000,
        },
        recommendTemplates({
          audience: "neutral",
          targetLength: "medium",
          goal: "volume",
          chemical: false,
        }),
        {
          taskId: crypto.randomUUID(),
          ownerSessionId: "test-session",
          userId: null,
          preferences: {
            ...DEFAULT_DESIGN_PREFERENCES,
            currentLength: "long",
            targetLength: "medium",
            goal: "volume",
            texture: "straight",
            parting: "center",
            dailyMinutes: 5,
            chemical: false,
          },
          imageDataUrl: "data:image/png;base64,iVBORw0KGgo=",
        },
      );

      expect(result.actualCostMicros).toBe(expectedCostMicros);
    },
  );

  it("cleans partial outputs and reports known provider cost when one variant fails", async () => {
    let submitted = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/openapi/v2/query")) {
          const taskId = JSON.parse(String(init?.body)).taskId;
          if (taskId === "rh-2")
            return Response.json({
              taskId,
              status: "FAILED",
              errorCode: "MODEL_FAILED",
              errorMessage: "模型失败",
              usage: { consumeMoney: "0.01" },
            });
          return Response.json({
            taskId,
            status: "SUCCESS",
            usage: { consumeMoney: "0.03" },
            results: [{ url: `https://images.example/${taskId}.png` }],
          });
        }
        if (url.startsWith("https://images.example/"))
          return new Response(new Uint8Array([137, 80, 78, 71]), {
            status: 200,
            headers: { "content-type": "image/png" },
          });
        submitted += 1;
        return Response.json({ taskId: `rh-${submitted}`, status: "RUNNING" });
      }),
    );
    const taskId = crypto.randomUUID();
    await expect(
      generateWithRunningHub(
        {
          endpoint: RUNNINGHUB_INTERNATIONAL_ENDPOINT,
          apiKey: "test-key",
          timeoutMs: 5000,
          costPerImageMicros: 15_000,
        },
        HAIRSTYLES.slice(0, 3),
        {
          taskId,
          ownerSessionId: "test-session",
          userId: null,
          preferences: DEFAULT_DESIGN_PREFERENCES,
          imageDataUrl: "data:image/png;base64,iVBORw0KGgo=",
        },
      ),
    ).rejects.toMatchObject({
      message: "MODEL_FAILED: 模型失败",
      errorCode: "MODEL_FAILED",
      errorMessage: "模型失败",
      actualCostMicros: 70_000,
    });
    expect(
      (
        db()
          .prepare(
            "SELECT COUNT(*) AS count FROM generated_assets WHERE task_id=?",
          )
          .get(taskId) as { count: number }
      ).count,
    ).toBe(0);
    expect(readdirSync(process.env.GENERATED_ASSETS_DIR!)).toHaveLength(0);
  });

  it("preserves and sanitizes submit error code and message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          errorCode: "40310",
        errorMessage:
          "供应商第一行\n   第二行 data:image/png;base64,iVBORw0KGgo= Bearer secret-token " +
          "x".repeat(700),
        }),
      ),
    );

    let caught: unknown;
    try {
      await generateWithRunningHub(
        {
          endpoint: RUNNINGHUB_INTERNATIONAL_ENDPOINT,
          apiKey: "test-key",
          timeoutMs: 5000,
          costPerImageMicros: 15_000,
        },
        HAIRSTYLES.slice(0, 1),
        {
          taskId: crypto.randomUUID(),
          ownerSessionId: "test-session",
          userId: null,
          preferences: DEFAULT_DESIGN_PREFERENCES,
          imageDataUrl: "data:image/png;base64,iVBORw0KGgo=",
        },
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    const providerError = caught as Error & {
      errorCode?: string;
      errorMessage?: string;
    };
    expect(providerError.errorCode).toBe("40310");
    expect(providerError.errorMessage?.startsWith("供应商第一行 第二行")).toBe(
      true,
    );
    expect(providerError.errorMessage).not.toContain("\n");
    expect(providerError.errorMessage).toContain("[IMAGE_REDACTED]");
    expect(providerError.errorMessage).toContain("Bearer [REDACTED]");
    expect(providerError.errorMessage?.length).toBeLessThanOrEqual(500);
    expect(providerError.message).toMatch(/^40310: /);
  });

  it("preserves polling failure error code and message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        if (String(input).endsWith("/openapi/v2/query"))
          return Response.json({
            taskId: "rh-failed",
            status: "FAILED",
            errorCode: "40310",
            errorMessage: "额度不足，请升级套餐",
          });
        return Response.json({ taskId: "rh-failed", status: "RUNNING" });
      }),
    );

    await expect(
      generateWithRunningHub(
        {
          endpoint: RUNNINGHUB_INTERNATIONAL_ENDPOINT,
          apiKey: "test-key",
          timeoutMs: 5000,
          costPerImageMicros: 15_000,
        },
        HAIRSTYLES.slice(0, 1),
        {
          taskId: crypto.randomUUID(),
          ownerSessionId: "test-session",
          userId: null,
          preferences: DEFAULT_DESIGN_PREFERENCES,
          imageDataUrl: "data:image/png;base64,iVBORw0KGgo=",
        },
      ),
    ).rejects.toMatchObject({
      message: "40310: 额度不足，请升级套餐",
      errorCode: "40310",
      errorMessage: "额度不足，请升级套餐",
    });
  });
});
