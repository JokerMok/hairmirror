import type {
  ConsultationInput,
  ConsultationProvider,
} from "@/lib/ai-consultation";

type ConsultationProviderConfig = {
  url: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
};

const configuredUrl = () => process.env.CONSULTATION_PROVIDER_URL?.trim() || "";

/** Returns true only when a remote consultation provider is explicitly configured. */
export function isConsultationProviderConfigured() {
  return Boolean(configuredUrl());
}

/** Reads the remote provider timeout while keeping it within a safe bound. */
export function configuredConsultationTimeoutMs() {
  const value = Number(process.env.CONSULTATION_PROVIDER_TIMEOUT_MS);
  return Number.isFinite(value) && value >= 1_000 && value <= 120_000
    ? value
    : 20_000;
}

/**
 * Creates the optional HTTP adapter used by salon consultation analysis.
 * The adapter is intentionally opt-in: without a URL, the caller must use the
 * safe deterministic fallback and no customer photo leaves the app.
 */
export function createConfiguredConsultationProvider(
  config: Partial<ConsultationProviderConfig> = {},
): ConsultationProvider | null {
  const url = config.url?.trim() || configuredUrl();
  if (!url) return null;

  let endpoint: URL;
  try {
    endpoint = new URL(url);
  } catch {
    throw new Error("CONSULTATION_PROVIDER_URL_INVALID");
  }
  if (endpoint.protocol !== "http:" && endpoint.protocol !== "https:") {
    throw new Error("CONSULTATION_PROVIDER_URL_INVALID");
  }

  const apiKey = config.apiKey ?? process.env.CONSULTATION_PROVIDER_API_KEY?.trim();
  const fetchImpl = config.fetchImpl ?? fetch;

  return {
    async analyze(input: ConsultationInput) {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          imageId: input.imageId ?? null,
          imageDataUrl: input.imageDataUrl ?? null,
          role: input.role ?? "consumer",
        }),
      });
      if (!response.ok) throw new Error(`CONSULTATION_PROVIDER_HTTP_${response.status}`);
      const payload = (await response.json()) as unknown;
      if (payload && typeof payload === "object" && "report" in payload) {
        return (payload as { report: unknown }).report;
      }
      if (payload && typeof payload === "object" && "data" in payload) {
        const data = (payload as { data: unknown }).data;
        if (data && typeof data === "object" && "report" in data) {
          return (data as { report: unknown }).report;
        }
      }
      return payload;
    },
  };
}
