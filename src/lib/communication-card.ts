import { assertRecommendationBelongsToConsultation, ConsultationDomainError } from "./consultation-domain";
import {
  normalizeConsultationBrief,
  targetHairColorText,
  type Consultation,
  type ConsultationBrief,
  type Recommendation,
} from "./types";

export type CommunicationCard = {
  consultationId: string;
  recommendationId: string;
  styleName: string;
  goal: string;
  whyItFits: string;
  instructions: {
    sides: string;
    top: string;
    texture: string;
    style: string;
  };
  preferences?: {
    treatment: string;
    color: string;
  };
  upkeep: string;
  confirmationPrompts: string[];
};

export type CommunicationCardResponse = {
  card: CommunicationCard;
  markdown: string;
};

const text = (value: unknown, fallback: string): string => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
};

function selectedRecommendation(consultation: Consultation): Recommendation {
  if (!consultation.selectedRecommendationId) {
    throw new ConsultationDomainError("RECOMMENDATION_NOT_FOUND");
  }
  const recommendation = consultation.recommendations.find(
    (item) => item.id === consultation.selectedRecommendationId,
  );
  assertRecommendationBelongsToConsultation(recommendation, consultation.id);
  if (!recommendation) throw new ConsultationDomainError("RECOMMENDATION_NOT_FOUND");
  return recommendation;
}

export function buildCommunicationCard(consultation: Consultation): CommunicationCard {
  const recommendation = selectedRecommendation(consultation);
  const execution = recommendation.execution ?? {};
  const analysis = consultation.analysisResult ?? {};
  const briefValue = analysis.consultationBrief;
  const brief = briefValue && typeof briefValue === "object"
    ? normalizeConsultationBrief(briefValue as Partial<ConsultationBrief> & { chemical?: boolean })
    : null;
  const targetColor = brief ? targetHairColorText(brief) : null;
  const goal = text(execution.suitableFor ?? analysis.goal, "Everyday wear");
  const whyItFits = text(
    recommendation.rationale || execution.advice,
    "Matches the selected consultation direction.",
  );
  const maintenanceMinutes = text(execution.maintenanceMinutes, "");
  const maintenanceLevel = text(execution.maintenanceLevel, "");
  const upkeep = [
    maintenanceMinutes && `${maintenanceMinutes} min daily styling`,
    maintenanceLevel && `${maintenanceLevel} maintenance`,
  ].filter(Boolean).join(" · ") || text(execution.advice, "Confirm the daily styling routine with your stylist.");

  return {
    consultationId: consultation.id,
    recommendationId: recommendation.id,
    styleName: recommendation.styleName,
    goal,
    whyItFits,
    instructions: {
      sides: text(execution.sides, "Confirm the side length and fade or taper."),
      top: text(execution.top, "Confirm the top length before the cut."),
      texture: text(execution.texture, "Use the selected direction's natural texture."),
      style: text(execution.style, recommendation.styleName),
    },
    preferences: {
      treatment: brief?.treatmentMode === "perm_allowed" ? "Perm allowed" : "Cut only",
      color: targetColor ?? "Preserve original",
    },
    upkeep,
    confirmationPrompts: [
      "Confirm the side length and fade or taper.",
      "Confirm the top length and texture level.",
      "Confirm the daily styling time and maintenance expectations.",
    ],
  };
}

export function toCommunicationCardMarkdown(card: CommunicationCard): string {
  return [
    `# Haircut consultation: ${card.styleName}`,
    "",
    `**Goal:** ${card.goal}`,
    `**Why it fits:** ${card.whyItFits}`,
    "",
    "## Haircut instructions",
    `- Sides: ${card.instructions.sides}`,
    `- Top: ${card.instructions.top}`,
    `- Texture: ${card.instructions.texture}`,
    `- Style: ${card.instructions.style}`,
    "",
    ...(card.preferences
      ? [
          "## User preferences",
          `- Hair treatment: ${card.preferences.treatment}`,
          `- Hair color: ${card.preferences.color}`,
          "",
        ]
      : []),
    `## Upkeep\n${card.upkeep}`,
    "",
    "## Confirm before starting",
    ...card.confirmationPrompts.map((prompt) => `- ${prompt}`),
  ].join("\n");
}
