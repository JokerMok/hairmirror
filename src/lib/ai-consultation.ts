import { z } from "zod";

import { createFallbackConsultation } from "@/lib/ai-consultation-fallback";
import {
  parseConsultationReport,
  type ConsultationReason,
  type ConsultationReport,
} from "@/lib/ai-consultation-schema";

export interface ConsultationInput {
  imageId?: string;
  role?: "consumer" | "stylist";
}

export interface ConsultationProvider {
  analyze(input: ConsultationInput): Promise<unknown>;
}

export interface ConsultationRunOptions {
  timeoutMs?: number;
  lowConfidenceThreshold?: number;
}

export interface ConsultationRunResult {
  report: ConsultationReport;
  source: "provider" | "fallback";
  reason?: ConsultationReason;
}

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_LOW_CONFIDENCE_THRESHOLD = 0.6;
const LOW_CONFIDENCE_EXPLANATION =
  "confidence is low because the photo does not provide enough detail. Treat these as starting options and confirm them with a stylist.";

class ConsultationTimeoutError extends Error {
  constructor() {
    super("consultation provider timed out");
    this.name = "ConsultationTimeoutError";
  }
}

function isTimeoutError(error: unknown): error is ConsultationTimeoutError {
  return error instanceof ConsultationTimeoutError;
}

export async function runConsultation(
  provider: ConsultationProvider,
  input: ConsultationInput,
  options: ConsultationRunOptions = {},
): Promise<ConsultationRunResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const lowConfidenceThreshold =
    options.lowConfidenceThreshold ?? DEFAULT_LOW_CONFIDENCE_THRESHOLD;
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  try {
    const timeout = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => reject(new ConsultationTimeoutError()), timeoutMs);
    });
    const raw = await Promise.race([provider.analyze(input), timeout]);
    const report = parseConsultationReport(raw);

    if (report.source !== "provider" || report.status === "fallback") {
      return {
        report: createFallbackConsultation("invalid_output"),
        source: "fallback",
        reason: "invalid_output",
      };
    }

    if (report.analysis.confidence < lowConfidenceThreshold) {
      return {
        report: parseConsultationReport({
          ...report,
          status: "low_confidence",
          explanation: LOW_CONFIDENCE_EXPLANATION,
        }),
        source: "provider",
        reason: "low_confidence",
      };
    }

    return { report, source: "provider" };
  } catch (error) {
    if (isTimeoutError(error)) {
      return {
        report: createFallbackConsultation("timeout"),
        source: "fallback",
        reason: "timeout",
      };
    }
    if (error instanceof z.ZodError) {
      return {
        report: createFallbackConsultation("invalid_output"),
        source: "fallback",
        reason: "invalid_output",
      };
    }
    return {
      report: createFallbackConsultation("provider_error"),
      source: "fallback",
      reason: "provider_error",
    };
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}
