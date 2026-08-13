import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SHOWCASE_CASES } from "@/components/home-showcase";

describe("public comparison evidence", () => {
  it("only publishes source-backed cases with one original and three outputs", () => {
    expect(SHOWCASE_CASES).toHaveLength(3);
    for (const item of SHOWCASE_CASES) {
      expect(item.source).toMatch(/^\/showcase\/sources\/.+\.(jpg|jpeg|png|webp)$/);
      expect(existsSync(resolve("public", item.source.slice(1)))).toBe(true);
      expect(item.styles).toHaveLength(3);
      for (const style of item.styles) {
        expect(style.image).toMatch(/^\/showcase\/cases\/case-0[2-4]\/style-0[1-3]\.jpg$/);
        expect(existsSync(resolve("public", style.image.slice(1)))).toBe(true);
        expect(style.label.en.length).toBeGreaterThan(0);
        expect(style.label.zh.length).toBeGreaterThan(0);
      }
    }
  });
});
