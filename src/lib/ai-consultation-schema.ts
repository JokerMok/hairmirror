import { z } from "zod";

const FORBIDDEN_INFERENCE =
  /\b(?:gender|sex|race|ethnicity|nationality|identity|age|medical|disease|diagnos(?:is|tic)?|health|disability|religion|sexual|pregnan(?:cy|t)|weight)\b|性别|种族|民族|国籍|身份|年龄|医疗|疾病|诊断|健康|残疾|宗教|性取向|孕妇|孕期|体重/i;

const safeText = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(500, `${label} is too long`)
    .refine((value) => !FORBIDDEN_INFERENCE.test(value), {
      message: `${label} contains an unsupported inference`,
    });

const safeTextList = (label: string, max: number) =>
  z.array(safeText(label)).min(1, `${label} must not be empty`).max(max);

export const ConsultationStatusSchema = z.enum([
  "complete",
  "low_confidence",
  "fallback",
]);
export const ConsultationSourceSchema = z.enum(["provider", "fallback"]);
export const ConsultationReasonSchema = z.enum([
  "timeout",
  "invalid_output",
  "provider_error",
  "low_confidence",
]);

export const ConsultationAnalysisSchema = z
  .object({
    faceShape: z.enum(["oval", "round", "square", "heart", "long", "unknown"]),
    headShape: safeText("head shape"),
    hairType: z.enum(["straight", "wavy", "curly", "coily", "unknown"]),
    currentCharacteristics: safeTextList("current characteristics", 5),
    confidence: z.number().min(0).max(1),
    limitations: safeTextList("limitations", 8),
  })
  .strict();

export const ConsultationRecommendationSchema = z
  .object({
    styleName: safeText("style name"),
    fitReason: safeText("fit reason"),
    suitableFor: safeText("suitable for"),
    maintenanceMinutes: z.number().int().min(0).max(180),
    maintenanceLevel: z.enum(["low", "medium", "high"]),
    executionAdvice: safeTextList("execution advice", 8),
  })
  .strict();

export const ConsultationReportSchema = z
  .object({
    version: z.literal("v0.3"),
    status: ConsultationStatusSchema,
    source: ConsultationSourceSchema,
    explanation: safeText("explanation"),
    analysis: ConsultationAnalysisSchema,
    recommendations: z.array(ConsultationRecommendationSchema).min(1).max(3),
  })
  .strict()
  .superRefine((report, context) => {
    const names = report.recommendations.map((recommendation) =>
      recommendation.styleName.toLocaleLowerCase(),
    );
    if (new Set(names).size !== names.length) {
      context.addIssue({
        code: "custom",
        path: ["recommendations"],
        message: "recommendations must contain unique styles",
      });
    }
  });

export type ConsultationStatus = z.infer<typeof ConsultationStatusSchema>;
export type ConsultationSource = z.infer<typeof ConsultationSourceSchema>;
export type ConsultationReason = z.infer<typeof ConsultationReasonSchema>;
export type ConsultationAnalysis = z.infer<typeof ConsultationAnalysisSchema>;
export type ConsultationRecommendation = z.infer<typeof ConsultationRecommendationSchema>;
export type ConsultationReport = z.infer<typeof ConsultationReportSchema>;

export function parseConsultationReport(value: unknown): ConsultationReport {
  return ConsultationReportSchema.parse(value);
}
