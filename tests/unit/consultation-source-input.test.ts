import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { consultationInputWithSourceImage } from "../../src/app/api/consultations/_repository";
import { persistSourceImage } from "../../src/lib/source-storage";

let directory = "";

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "hair-consultation-source-"));
  process.env.SOURCE_UPLOADS_DIR = join(directory, "uploads");
});

afterEach(() => {
  delete process.env.SOURCE_UPLOADS_DIR;
  rmSync(directory, { recursive: true, force: true });
});

describe("consultation source input", () => {
  it("reads the stored source photo into the provider input", () => {
    const source = persistSourceImage(
      "data:image/png;base64,iVBORw0KGgo=",
      "consultation-source-test",
    );

    expect(
      consultationInputWithSourceImage(
        { sourcePhotoPath: source.path },
        { role: "stylist" },
      ),
    ).toMatchObject({
      role: "stylist",
      imageDataUrl: "data:image/png;base64,iVBORw0KGgo=",
    });
  });

  it("does not invent a source image for legacy drafts without one", () => {
    expect(
      consultationInputWithSourceImage(
        { sourcePhotoPath: null },
        { role: "stylist" },
      ),
    ).toEqual({ role: "stylist" });
  });
});
