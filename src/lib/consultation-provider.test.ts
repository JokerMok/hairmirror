import { afterEach, describe, expect, it, vi } from "vitest";
import {
  configuredConsultationTimeoutMs,
  createConfiguredConsultationProvider,
  isConsultationProviderConfigured,
} from "@/lib/consultation-provider";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("consultation provider adapter", () => {
  it("stays disabled until a provider URL is configured", () => {
    vi.stubEnv("CONSULTATION_PROVIDER_URL", "");

    expect(isConsultationProviderConfigured()).toBe(false);
    expect(createConfiguredConsultationProvider()).toBeNull();
  });

  it("uses the configured endpoint and unwraps a report payload", async () => {
    vi.stubEnv("CONSULTATION_PROVIDER_URL", "https://provider.example/analyze");
    vi.stubEnv("CONSULTATION_PROVIDER_API_KEY", "secret");
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ report: { status: "ready" } }),
    }) as Response);

    const provider = createConfiguredConsultationProvider({ fetchImpl });
    const result = await provider?.analyze({ imageId: "image-1", role: "stylist" });

    expect(result).toEqual({ status: "ready" });
    expect(fetchImpl).toHaveBeenCalledWith(
      new URL("https://provider.example/analyze"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ authorization: "Bearer secret" }),
        body: JSON.stringify({ imageId: "image-1", role: "stylist" }),
      }),
    );
  });

  it("unwraps a nested data report and rejects non-success responses", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { report: { status: "ready" } } }),
      } as Response)
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) } as Response);
    const provider = createConfiguredConsultationProvider({
      url: "https://provider.example/analyze",
      fetchImpl,
    });

    await expect(provider?.analyze({})).resolves.toEqual({ status: "ready" });
    await expect(provider?.analyze({})).rejects.toThrow("CONSULTATION_PROVIDER_HTTP_500");
  });

  it("rejects unsupported provider URLs and clamps timeout configuration", () => {
    expect(() => createConfiguredConsultationProvider({ url: "ftp://provider.example" })).toThrow(
      "CONSULTATION_PROVIDER_URL_INVALID",
    );

    vi.stubEnv("CONSULTATION_PROVIDER_TIMEOUT_MS", "250");
    expect(configuredConsultationTimeoutMs()).toBe(20_000);
    vi.stubEnv("CONSULTATION_PROVIDER_TIMEOUT_MS", "45000");
    expect(configuredConsultationTimeoutMs()).toBe(45_000);
    vi.stubEnv("CONSULTATION_PROVIDER_TIMEOUT_MS", "999999");
    expect(configuredConsultationTimeoutMs()).toBe(20_000);
  });
});
