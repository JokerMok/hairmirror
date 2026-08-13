import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

describe("search discovery files", () => {
  it("publishes all public decision pages in the sitemap", () => {
    const paths = sitemap().map((entry) => new URL(entry.url).pathname);
    expect(paths).toEqual(["/", "/salon", "/faq", "/privacy", "/terms", "/refunds"]);
    expect(paths).not.toContain("/account");
    expect(paths).not.toContain("/admin");
  });

  it("keeps private and operational routes out of crawlers", () => {
    const rules = robots().rules;
    expect(rules).toMatchObject({
      userAgent: "*",
      allow: "/",
      disallow: ["/account", "/admin", "/api", "/billing", "/login"],
    });
  });
});
