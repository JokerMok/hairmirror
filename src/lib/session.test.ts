import { afterEach, describe, expect, it } from "vitest";
import {
  adminCookieValue,
  isAdminCookieValue,
  safeRedirectUrl,
} from "./session";

describe("safeRedirectUrl", () => {
  afterEach(() => {
    delete process.env.PUBLIC_APP_URL;
    delete process.env.RAILWAY_PUBLIC_DOMAIN;
    delete process.env.ADMIN_USERNAME;
    delete process.env.ADMIN_PASSWORD;
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

  it("uses the current Quick Tunnel when the configured tunnel address is stale", () => {
    process.env.PUBLIC_APP_URL =
      "https://old-tunnel.trycloudflare.com/ignored-path";
    expect(
      safeRedirectUrl(
        new Request("https://new-tunnel.trycloudflare.com/api/admin/login"),
        "/admin",
      ).toString(),
    ).toBe("https://new-tunnel.trycloudflare.com/admin");
  });

  it("recognizes the current Quick Tunnel from reverse-proxy headers", () => {
    process.env.PUBLIC_APP_URL =
      "https://old-tunnel.trycloudflare.com/ignored-path";
    expect(
      safeRedirectUrl(
        new Request("http://127.0.0.1:3000/api/admin/login", {
          headers: {
            host: "new-tunnel.trycloudflare.com",
            "x-forwarded-proto": "https",
          },
        }),
        "/admin",
      ).toString(),
    ).toBe("https://new-tunnel.trycloudflare.com/admin");
  });

  it("does not replace a configured canonical origin with a temporary tunnel", () => {
    process.env.PUBLIC_APP_URL = "https://hair.example";
    expect(
      safeRedirectUrl(
        new Request("https://temporary.trycloudflare.com/api/admin/login"),
        "/admin",
      ).toString(),
    ).toBe("https://hair.example/admin");
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

describe("admin credentials", () => {
  afterEach(() => {
    delete process.env.ADMIN_USERNAME;
    delete process.env.ADMIN_PASSWORD;
  });

  it("accepts a cookie derived from the configured username and password", () => {
    process.env.ADMIN_USERNAME = "admin";
    process.env.ADMIN_PASSWORD = "admin_joker";

    expect(
      isAdminCookieValue(adminCookieValue("admin", "admin_joker")),
    ).toBe(true);
    expect(
      isAdminCookieValue(adminCookieValue("admin", "wrong-password")),
    ).toBe(false);
  });

  it("keeps the admin area closed when either credential is missing", () => {
    process.env.ADMIN_USERNAME = "admin";

    expect(
      isAdminCookieValue(adminCookieValue("admin", "admin_joker")),
    ).toBe(false);
  });
});
