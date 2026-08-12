import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyze, createDraft } from "../../src/app/api/consultations/_repository";
import { hashPassword } from "../../src/lib/auth";
import { closeDatabaseForTest, db } from "../../src/lib/database";
import { persistSourceImage } from "../../src/lib/source-storage";

let directory = "";
const userId = "00000000-0000-4000-8000-000000000571";

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "hair-consultation-analysis-"));
  process.env.SQLITE_PATH = join(directory, "test.db");
  process.env.SOURCE_UPLOADS_DIR = join(directory, "uploads");
  process.env.CONSULTATION_PROVIDER_URL = "https://provider.example/analyze";
  db()
    .prepare(
      "INSERT INTO users(id,phone,email,name,password_hash,role,status,created_at) VALUES(?,?,?,?,?,'store_owner','active',?)",
    )
    .run(
      userId,
      "analysis-source-571",
      "analysis-source-571@example.com",
      "Analysis Owner",
      hashPassword("password123"),
      new Date().toISOString(),
    );
  db()
    .prepare("INSERT INTO salons(id,name,owner_user_id,created_at,updated_at) VALUES(?,?,?,?,?)")
    .run("salon-analysis-571", "Analysis Salon", userId, new Date().toISOString(), new Date().toISOString());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  closeDatabaseForTest();
  rmSync(directory, { recursive: true, force: true });
});

describe("consultation analysis source", () => {
  it("passes the stored customer photo to the configured provider", async () => {
    const source = persistSourceImage(
      "data:image/png;base64,iVBORw0KGgo=",
      "consultation-analysis-571",
    );
    const draft = createDraft({
      id: "consultation-analysis-571",
      salonId: "salon-analysis-571",
      stylistUserId: userId,
      sourcePhotoPath: source.path,
    }).item;
    const fetchMock = vi.fn(async (...args: Parameters<typeof fetch>) => {
      void args;
      return {
        ok: true,
        json: async () => ({
          report: {
            version: "v0.3",
            status: "complete",
            source: "provider",
            explanation: "A clear photo supports a practical starting point.",
            analysis: {
              faceShape: "oval",
              headShape: "Balanced profile",
              hairType: "straight",
              currentCharacteristics: ["Visible front profile"],
              confidence: 0.9,
              limitations: ["Confirm the final length in person"],
            },
            recommendations: [
              {
                styleName: "Clean Side Part",
                fitReason: "Keeps the shape easy to maintain.",
                suitableFor: "Regular salon upkeep",
                maintenanceMinutes: 10,
                maintenanceLevel: "low",
                executionAdvice: ["Keep the sides clean"],
              },
            ],
          },
        }),
      } as Response;
    });
    const fetchImpl = fetchMock as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchImpl);

    await analyze(draft, { role: "stylist" });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      imageDataUrl?: string;
      role?: string;
    };
    expect(body).toEqual({
      imageDataUrl: "data:image/png;base64,iVBORw0KGgo=",
      imageId: null,
      role: "stylist",
    });
  });
});
