import { describe, expect, it } from "vitest";
import { buildCommunicationCard, toCommunicationCardMarkdown } from "@/lib/communication-card";
import { ConsultationDomainError } from "@/lib/consultation-domain";
import type { Consultation } from "@/lib/types";

const consultation = (selectedRecommendationId: string | null = "rec-1"): Consultation => ({
  id: "consultation-1", salonId: "salon-1", customerUserId: null, stylistUserId: "stylist-1", status: "completed",
  sourcePhotoPath: "/private/source.jpg", analysisResult: { face_shape: "oval" }, selectedRecommendationId,
  createdAt: "2026-07-30T00:00:00.000Z", updatedAt: "2026-07-30T00:00:00.000Z",
  recommendations: [{ id: "rec-1", consultationId: "consultation-1", styleName: "Textured Crop", rationale: "Balances facial length.", execution: { suitableFor: "Daily wear", maintenanceMinutes: "1", maintenanceLevel: "Low", advice: "Use a small amount of matte paste." }, imageUrl: null, rank: 1, createdAt: "2026-07-30T00:00:00.000Z" }],
});

describe("communication card", () => {
  it("builds an actionable card from a selected recommendation", () => {
    const card = buildCommunicationCard(consultation());
    expect(card.styleName).toBe("Textured Crop");
    expect(card.instructions.sides).toContain("side length");
    expect(card.upkeep).toContain("1 min");
    expect(card.confirmationPrompts).toHaveLength(3);
  });

  it("requires a selected recommendation", () => {
    expect(() => buildCommunicationCard(consultation(null))).toThrowError(ConsultationDomainError);
    try { buildCommunicationCard(consultation(null)); } catch (error) { expect((error as ConsultationDomainError).code).toBe("RECOMMENDATION_NOT_FOUND"); }
  });

  it("renders safe markdown without private source data", () => {
    const markdown = toCommunicationCardMarkdown(buildCommunicationCard(consultation()));
    expect(markdown).toContain("Textured Crop");
    expect(markdown).toContain("Confirm before starting");
    expect(markdown).not.toContain("source.jpg");
    expect(markdown).not.toContain("stylist-1");
  });
});
