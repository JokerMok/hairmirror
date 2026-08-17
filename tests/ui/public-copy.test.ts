import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pages = ["faq", "privacy", "terms", "refunds"];
const read = (page: string) => readFileSync(resolve("src", "app", page, "page.tsx"), "utf8");

describe("free-pilot public copy", () => {
  it("does not expose inactive payment vendors or prices", () => {
    const content = pages.map(read).join("\n");
    for (const stale of ["$1.99", "$29", "Paddle", "Gumroad", "GUMROAD", "NEXT_PUBLIC_PADDLE"]) {
      expect(content).not.toContain(stale);
    }
  });

  it("does not claim an already published support channel without an address", () => {
    const content = pages.map(read).join("\n");
    expect(content).not.toMatch(/published support channel/i);
    expect(content).toMatch(/support email will be configured|支持邮箱将在邀请外部试用前配置/);
  });

  it("uses the public Sites origin and a real static share image", () => {
    const site = readFileSync(resolve("src", "lib", "site.ts"), "utf8");
    const layout = readFileSync(resolve("src", "app", "layout.tsx"), "utf8");
    expect(site).toContain("hairmirror-v03.lopezerendira678.chatgpt.site");
    expect(site).not.toContain("web-production-eeda8.up.railway.app");
    expect(layout).toContain("image2-hairstyle-board.png");
    expect(layout).toContain("zh_CN");
  });

  it("keeps payments disabled in the deployment template", () => {
    const env = readFileSync(resolve(".env.example"), "utf8");
    expect(env).toContain("BILLING_PROVIDER=disabled");
  });
});
