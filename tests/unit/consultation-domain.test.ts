import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  assertConsultationAccess,
  assertRecommendationBelongsToConsultation,
  assertStatusTransition,
  assertTenantForSalon,
  assertValidConsultationInput,
  canAccessConsultation,
  canTransitionConsultation,
  isConsultationStatus,
} from "../../src/lib/consultation-domain";
import { closeDatabaseForTest, db } from "../../src/lib/database";
import { CONSULTATION_STATUSES } from "../../src/lib/types";

const env = process.env as Record<string, string | undefined>;
const originalNodeEnv = env.NODE_ENV;
const originalSqlitePath = env.SQLITE_PATH;

afterEach(() => {
  if (env.NODE_ENV === "test") {
    closeDatabaseForTest();
  }
  if (originalNodeEnv === undefined) delete env.NODE_ENV;
  else env.NODE_ENV = originalNodeEnv;
  if (originalSqlitePath === undefined) delete env.SQLITE_PATH;
  else env.SQLITE_PATH = originalSqlitePath;
});

describe("consultation state and validation", () => {
  it("enumerates valid statuses and rejects unknown values", () => {
    for (const status of CONSULTATION_STATUSES) {
      expect(isConsultationStatus(status)).toBe(true);
    }
    expect(isConsultationStatus("processing")).toBe(false);
  });

  it("allows only the documented state transitions", () => {
    expect(canTransitionConsultation("draft", "analyzing")).toBe(true);
    expect(canTransitionConsultation("analyzing", "ready")).toBe(true);
    expect(canTransitionConsultation("ready", "shared")).toBe(true);
    expect(canTransitionConsultation("shared", "completed")).toBe(true);
    expect(canTransitionConsultation("completed", "archived")).toBe(true);
    expect(canTransitionConsultation("draft", "ready")).toBe(false);
    expect(canTransitionConsultation("archived", "draft")).toBe(false);
    expect(() => assertStatusTransition("draft", "ready")).toThrowError(
      expect.objectContaining({ code: "INVALID_STATUS_TRANSITION" }),
    );
  });

  it("enforces customer ownership and salon tenant boundaries", () => {
    const consultation = { salonId: "salon-a", customerUserId: "customer-a" };
    expect(
      canAccessConsultation(
        { userId: "stylist-a", tenantId: "salon-a", role: "stylist" },
        consultation,
      ),
    ).toBe(true);
    expect(
      canAccessConsultation(
        { userId: "admin-a", tenantId: "salon-a", role: "salon_admin" },
        consultation,
      ),
    ).toBe(true);
    expect(
      canAccessConsultation(
        { userId: "stylist-b", tenantId: "salon-b", role: "stylist" },
        consultation,
      ),
    ).toBe(false);
    expect(
      canAccessConsultation(
        { userId: "customer-a", tenantId: null, role: "consumer" },
        consultation,
      ),
    ).toBe(true);
    expect(
      canAccessConsultation(
        { userId: "customer-b", tenantId: null, role: "consumer" },
        consultation,
      ),
    ).toBe(false);
    expect(() =>
      assertConsultationAccess(
        { userId: "stylist-b", tenantId: "salon-b", role: "stylist" },
        consultation,
      ),
    ).toThrowError(expect.objectContaining({ code: "CONSULTATION_FORBIDDEN" }));
  });

  it("protects tenant-required and recommendation lookups", () => {
    expect(assertTenantForSalon({ userId: "u", tenantId: "salon-a", role: "stylist" })).toBe(
      "salon-a",
    );
    expect(() =>
      assertTenantForSalon({ userId: "u", tenantId: null, role: "stylist" }),
    ).toThrowError(expect.objectContaining({ code: "TENANT_REQUIRED" }));
    expect(() =>
      assertRecommendationBelongsToConsultation(
        { consultationId: "consultation-a" },
        "consultation-a",
      ),
    ).not.toThrow();
    expect(() =>
      assertRecommendationBelongsToConsultation(
        { consultationId: "consultation-b" },
        "consultation-a",
      ),
    ).toThrowError(expect.objectContaining({ code: "RECOMMENDATION_NOT_FOUND" }));
  });

  it("rejects empty consultation inputs", () => {
    expect(() => assertValidConsultationInput({})).toThrowError(
      expect.objectContaining({ code: "INVALID_CONSULTATION_INPUT" }),
    );
    expect(() => assertValidConsultationInput({ salonId: "salon-a", sourcePhotoPath: "  " })).toThrowError(
      expect.objectContaining({ code: "INVALID_CONSULTATION_INPUT" }),
    );
    expect(() => assertValidConsultationInput({ customerUserId: "customer-a" })).not.toThrow();
  });
});

describe("consultation migrations", () => {
  it("can run repeatedly without changing the schema", () => {
    const directory = mkdtempSync(join(tmpdir(), "hairmirror-t001-"));
    env.NODE_ENV = "test";
    env.SQLITE_PATH = join(directory, "db.sqlite");

    try {
      const first = db()
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('salons','consultations','recommendations') ORDER BY name",
        )
        .all() as Array<{ name: string }>;
      expect(first.map((row) => row.name)).toEqual(["consultations", "recommendations", "salons"]);

      closeDatabaseForTest();
      const second = db()
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('salons','consultations','recommendations') ORDER BY name",
        )
        .all() as Array<{ name: string }>;
      expect(second.map((row) => row.name)).toEqual(first.map((row) => row.name));
    } finally {
      if (env.NODE_ENV === "test") closeDatabaseForTest();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
