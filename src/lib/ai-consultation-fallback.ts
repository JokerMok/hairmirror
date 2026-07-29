import type {
  ConsultationReason,
  ConsultationReport,
} from "@/lib/ai-consultation-schema";
import { parseConsultationReport } from "@/lib/ai-consultation-schema";

const FALLBACK_MESSAGES: Record<ConsultationReason, string> = {
  timeout: "The consultation is taking longer than expected. Here are safe starting options to discuss with a stylist.",
  invalid_output: "The consultation response could not be verified. Here are safe starting options to discuss with a stylist.",
  provider_error: "The consultation service is temporarily unavailable. Here are safe starting options to discuss with a stylist.",
  low_confidence: "The photo does not provide enough detail for a confident analysis. Use these options as a starting point and confirm them with a stylist.",
};

export function createFallbackConsultation(
  reason: ConsultationReason = "provider_error",
): ConsultationReport {
  return parseConsultationReport({
    version: "v0.3",
    status: "fallback",
    source: "fallback",
    explanation: FALLBACK_MESSAGES[reason],
    analysis: {
      faceShape: "unknown",
      headShape: "Not enough visual detail to assess",
      hairType: "unknown",
      currentCharacteristics: ["A clear assessment needs a front-facing photo with even light."],
      confidence: 0,
      limitations: [
        "This fallback does not assess facial or hair characteristics.",
        "Confirm length, texture, and density with a professional stylist.",
      ],
    },
    recommendations: [
      {
        styleName: "Soft Textured Crop",
        fitReason: "A flexible short option that is easy to adjust after an in-person assessment.",
        suitableFor: "A practical everyday look",
        maintenanceMinutes: 3,
        maintenanceLevel: "low",
        executionAdvice: [
          "Keep enough length on top for light texture.",
          "Ask the stylist to soften the sides gradually.",
        ],
      },
      {
        styleName: "Natural Side Part",
        fitReason: "Keeps the overall shape adaptable while preserving useful length on top.",
        suitableFor: "Work and everyday styling",
        maintenanceMinutes: 4,
        maintenanceLevel: "medium",
        executionAdvice: [
          "Keep the top long enough to part naturally.",
          "Use a light styling product rather than a stiff finish.",
        ],
      },
      {
        styleName: "Medium Layered Shape",
        fitReason: "Preserves flexibility when the desired length or texture is not yet clear.",
        suitableFor: "Trying a softer change",
        maintenanceMinutes: 5,
        maintenanceLevel: "medium",
        executionAdvice: [
          "Build subtle layers only after confirming the current texture.",
          "Leave room for a follow-up adjustment after the first wash.",
        ],
      },
    ],
  });
}
