import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDatabaseForTest, db } from "./database";
import {
  addFeedback,
  addTask,
  cleanupExpiredTasks,
  deleteTask,
  listFeedback,
  listTasks,
  resetTaskStoreForTest,
} from "./task-store";
import { DEFAULT_DESIGN_PREFERENCES, type StoredDesignTask } from "./types";

const task: StoredDesignTask = {
  id: "00000000-0000-4000-8000-000000000001",
  ownerSessionId: "owner-a",
  userId: null,
  status: "completed",
  createdAt: "2026-07-12T00:00:00.000Z",
  generationMode: "mock",
  preferences: {
    ...DEFAULT_DESIGN_PREFERENCES,
    audience: "neutral",
    currentLength: "short",
    targetLength: "short",
    goal: "fresh",
    treatmentMode: "cut_only",
    colorMode: "preserve",
    dailyMinutes: 5,
  },
  variants: [
    {
      id: "00000000-0000-4000-8000-000000000002",
      reason: "test",
      template: {
        id: "style",
        name: "Style",
        audience: "all",
        length: "short",
        goal: ["fresh"],
        maintenance: "低",
        conditions: "none",
        description: "test",
        visual: "crop",
        previewColor: "#000",
      },
    },
  ],
};

let directory = "";
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "hair-task-store-"));
  process.env.SQLITE_PATH = join(directory, "test.db");
  process.env.GENERATED_ASSETS_DIR = join(directory, "generated");
  resetTaskStoreForTest();
});
afterEach(() => {
  closeDatabaseForTest();
  delete process.env.SQLITE_PATH;
  delete process.env.GENERATED_ASSETS_DIR;
  rmSync(directory, { recursive: true, force: true });
});

describe("persistent task ownership", () => {
  it("persists tasks and feedback after reopening the database", () => {
    addTask(structuredClone(task));
    const feedback = {
      id: "f",
      taskId: task.id,
      variantId: task.variants[0].id,
      helpful: true,
      createdAt: "now",
    };
    expect(addFeedback(feedback, "attacker", null)).toBe(false);
    expect(
      addFeedback({ ...feedback, variantId: "missing" }, "owner-a", null),
    ).toBe(false);
    expect(addFeedback(feedback, "owner-a", null)).toBe(true);
    closeDatabaseForTest();
    expect(listTasks("owner-a", null)).toHaveLength(1);
    expect(listTasks("owner-a", null)[0].selectedVariantId).toBe(
      task.variants[0].id,
    );
    expect(listFeedback()).toHaveLength(1);
  });

  it("fills new preference defaults when reading an older saved task", () => {
    const legacy = structuredClone(task);
    const preferences = legacy.preferences as unknown as Record<string, unknown>;
    delete preferences.texture;
    delete preferences.density;
    delete preferences.faceShape;
    delete preferences.fringe;
    delete preferences.parting;
    addTask(legacy);
    const saved = listTasks("owner-a", null)[0];
    expect(saved.preferences).toMatchObject({
      texture: "straight",
      density: "medium",
      faceShape: "auto",
      fringe: "open",
      parting: "auto",
      treatmentMode: "cut_only",
      colorMode: "preserve",
    });
  });

  it("maps legacy chemical preferences to treatment while preserving original color", () => {
    const legacy = structuredClone(task);
    const preferences = legacy.preferences as unknown as Record<string, unknown>;
    delete preferences.treatmentMode;
    delete preferences.colorMode;
    preferences.chemical = true;
    addTask(legacy);
    expect(listTasks("owner-a", null)[0].preferences).toMatchObject({
      treatmentMode: "perm_allowed",
      colorMode: "preserve",
    });
    expect(listTasks("owner-a", null)[0].preferences.targetHairColor).toBeUndefined();
  });

  it("keeps only the latest explicit result feedback", () => {
    addTask(structuredClone(task));
    const base = {
      taskId: task.id,
      variantId: task.variants[0].id,
      helpful: false,
    };
    expect(
      addFeedback(
        {
          ...base,
          id: "first-signal",
          issue: "预览不可信",
          createdAt: "2026-07-12T00:01:00.000Z",
        },
        "owner-a",
        null,
      ),
    ).toBe(true);
    expect(
      addFeedback(
        {
          ...base,
          id: "second-signal",
          helpful: true,
          issue: "愿意尝试",
          createdAt: "2026-07-12T00:02:00.000Z",
        },
        "owner-a",
        null,
      ),
    ).toBe(true);
    expect(listFeedback()).toHaveLength(1);
    expect(listFeedback()[0]).toMatchObject({
      id: "second-signal",
      issue: "愿意尝试",
      helpful: 1,
    });
  });

  it("rejects cross-session deletion and removes owned media", () => {
    addTask(structuredClone(task));
    const assetDirectory = process.env.GENERATED_ASSETS_DIR!;
    mkdirSync(assetDirectory, { recursive: true });
    const assetPath = join(assetDirectory, "result.png");
    writeFileSync(assetPath, "image", { mode: 0o600 });
    db()
      .prepare(
        "INSERT INTO generated_assets(id,task_id,owner_session_id,user_id,file_path,mime_type,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?)",
      )
      .run(
        "00000000-0000-4000-8000-000000000003",
        task.id,
        "owner-a",
        null,
        assetPath,
        "image/png",
        task.createdAt,
        Date.now() + 10000,
      );
    expect(deleteTask(task.id, "attacker", null)).toBe(false);
    expect(existsSync(assetPath)).toBe(true);
    expect(deleteTask(task.id, "owner-a", null, assetDirectory)).toBe(true);
    expect(existsSync(assetPath)).toBe(false);
    expect(listTasks("owner-a", null)).toHaveLength(0);
    expect(
      (
        db()
          .prepare("SELECT COUNT(*) AS count FROM generated_assets")
          .get() as { count: number }
      ).count,
    ).toBe(0);
  });

  it("hard-deletes expired task metadata, selections and feedback after 30 days", () => {
    addTask(structuredClone(task));
    addFeedback(
      {
        id: "expired-feedback",
        taskId: task.id,
        variantId: task.variants[0].id,
        helpful: true,
        createdAt: task.createdAt,
      },
      "owner-a",
      null,
    );
    const now = Date.parse(task.createdAt) + 31 * 24 * 60 * 60 * 1000;
    expect(cleanupExpiredTasks(now)).toEqual({
      found: 1,
      deleted: 1,
      skipped: 0,
    });
    expect(listTasks("owner-a", null)).toHaveLength(0);
    expect(listFeedback()).toHaveLength(0);
    expect(
      (
        db().prepare("SELECT COUNT(*) AS count FROM task_selections").get() as {
          count: number;
        }
      ).count,
    ).toBe(0);
  });
});
