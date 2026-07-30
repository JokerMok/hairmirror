import { beforeEach, describe, expect, it } from "vitest";
import {
  analyticsEventSchema,
  getSalonWeeklyMetrics,
  recordAnalyticsEvent,
} from "@/lib/analytics-events";
import { db } from "@/lib/database";

describe("analytics event contract", () => {
  beforeEach(() => {
    db().exec("DELETE FROM operational_events WHERE event_type LIKE 'analytics.%'");
  });

  it("accepts every product event without allowing free-form PII fields", () => {
    const events = [
      { event: "role_selected", role: "stylist", entryPoint: "salon_invite" },
      {
        event: "photo_uploaded",
        role: "stylist",
        surface: "salon",
        photoCount: 1,
        source: "camera",
        fileType: "jpg",
        fileSizeBucket: "1_4mb",
      },
      {
        event: "analysis_completed",
        role: "stylist",
        surface: "salon",
        confidenceBand: "high",
        recommendationCount: 3,
        duration: "5_15s",
      },
      {
        event: "recommendations_viewed",
        role: "stylist",
        surface: "salon",
        recommendationCount: 3,
        viewMode: "comparison",
      },
      {
        event: "generation_succeeded",
        role: "stylist",
        surface: "salon",
        variantCount: 3,
        duration: "15_30s",
      },
      {
        event: "generation_failed",
        role: "stylist",
        surface: "salon",
        errorCode: "timeout",
        retryable: true,
      },
      {
        event: "communication_card_copied",
        role: "stylist",
        surface: "salon",
        format: "markdown",
        hasSelectedStyle: true,
      },
      {
        event: "consultation_saved",
        role: "stylist",
        surface: "salon",
        recommendationCount: 3,
        hasSelectedStyle: true,
      },
    ];
    for (const event of events) expect(analyticsEventSchema.safeParse(event).success).toBe(true);
    expect(
      analyticsEventSchema.safeParse({
        event: "role_selected",
        role: "stylist",
        entryPoint: "landing",
        email: "private@example.com",
      }).success,
    ).toBe(false);
  });

  it("stores pseudonymous context and computes Salon weekly activation", () => {
    const week = new Date("2026-07-27T00:00:00.000Z");
    const user = {
      id: "user-1",
      phone: "13800000000",
      email: "private@example.com",
      name: "Private Name",
      role: "staff" as const,
      storeId: "salon-1",
      storeName: "Private Salon",
      status: "active" as const,
      createdAt: week.toISOString(),
    };
    const event = {
      event: "consultation_saved" as const,
      role: "stylist" as const,
      surface: "salon" as const,
      recommendationCount: 3,
      hasSelectedStyle: true,
    };
    expect(recordAnalyticsEvent(event, { user }, new Date("2026-07-28T12:00:00.000Z"))).toBe(true);
    const row = db()
      .prepare("SELECT details_json FROM operational_events WHERE event_type='analytics.consultation_saved'")
      .get() as { details_json: string };
    expect(row.details_json).not.toContain("private@example.com");
    expect(row.details_json).not.toContain("Private Name");
    expect(row.details_json).not.toContain("13800000000");
    const metrics = getSalonWeeklyMetrics(week);
    expect(metrics.activatedSalons).toBe(1);
    expect(metrics.activeSalons).toBe(1);
    expect(metrics.consultationsSaved).toBe(1);
  });
});

