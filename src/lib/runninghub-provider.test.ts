import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HAIRSTYLES } from "./catalog";
import { closeDatabaseForTest, db } from "./database";
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
        endpoint:
          "https://www.runninghub.cn/openapi/v2/rhart-image-n-g31-flash-lite/image-to-image",
        apiKey: "test-key",
        timeoutMs: 5000,
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
          endpoint:
            "https://www.runninghub.cn/openapi/v2/rhart-image-n-g31-flash-lite/image-to-image",
          apiKey: "test-key",
          timeoutMs: 5000,
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
      message: "MODEL_FAILED",
      actualCostMicros: 60_000,
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
});
