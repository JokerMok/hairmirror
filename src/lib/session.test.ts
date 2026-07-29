import { afterEach, describe, expect, it } from "vitest";
import { safeRedirectUrl } from "./session";

describe("safeRedirectUrl", () => {
  afterEach(() => {
    delete process.env.PUBLIC_APP_URL;
    delete process.env.RAILWAY_PUBLIC_DOMAIN;
  });

  it("replaces the non-browsable development bind address", () => {
    expect(
      safeRedirectUrl(
        new Request("http://0.0.0.0:3000/api/admin/models/example"),
        "/admin/models/example?saved=1",
      ).toString(),
    ).toBe("http://127.0.0.1:3000/admin/models/example?saved=1");
  });

  it("keeps a real deployment origin and blocks protocol-relative redirects", () => {
    expect(
      safeRedirectUrl(
        new Request("https://hair.example/api/admin/login"),
        "/admin",
      ).toString(),
    ).toBe("https://hair.example/admin");
    expect(() =>
      safeRedirectUrl(
        new Request("https://hair.example/api/admin/login"),
        "//evil.example",
      ),
    ).toThrow("INVALID_REDIRECT_PATH");
  });

  it("uses the configured public origin behind a Railway proxy", () => {
    process.env.PUBLIC_APP_URL =
      "https://web-production-eeda8.up.railway.app/ignored-path";
    expect(
      safeRedirectUrl(
        new Request("https://0.0.0.0:8080/api/admin/login"),
        "/admin?error=invalid",
      ).toString(),
    ).toBe(
      "https://web-production-eeda8.up.railway.app/admin?error=invalid",
    );
  });

  it("uses Railway's public domain when no explicit origin is configured", () => {
    process.env.RAILWAY_PUBLIC_DOMAIN =
      "web-production-eeda8.up.railway.app";
    expect(
      safeRedirectUrl(
        new Request("https://0.0.0.0:8080/api/admin/login"),
        "/admin",
      ).toString(),
    ).toBe("https://web-production-eeda8.up.railway.app/admin");
  });
});
