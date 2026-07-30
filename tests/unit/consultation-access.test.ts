import { describe, expect, it } from "vitest";
import {
  actorFromAuthUser,
  consultationRetentionCutoff,
  isConsultationExpired,
} from "../../src/lib/consultation-access";
import type { AuthUser } from "../../src/lib/database";

const makeUser = (role: AuthUser["role"], storeId: string | null = "store-1"): AuthUser => ({
  id: "user-1",
  phone: "13800000000",
  email: "test@example.com",
  name: "Test",
  role,
  storeId,
  storeName: storeId ? "Test salon" : null,
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
});

describe("consultation access retention", () => {
  const now = Date.parse("2026-07-30T00:00:00.000Z");

  it("uses a 30-day retention cutoff", () => {
    expect(consultationRetentionCutoff(now)).toBe("2026-06-30T00:00:00.000Z");
  });

  it("expires records older than cutoff but keeps the exact boundary", () => {
    expect(isConsultationExpired("2026-06-29T23:59:59.999Z", now)).toBe(true);
    expect(isConsultationExpired("2026-06-30T00:00:00.000Z", now)).toBe(false);
    expect(isConsultationExpired("not-a-date", now)).toBe(false);
  });

  it("maps auth users to tenant-scoped actors", () => {
    expect(actorFromAuthUser(makeUser("personal", null))).toEqual({
      userId: "user-1",
      tenantId: null,
      role: "consumer",
    });
    expect(actorFromAuthUser(makeUser("staff"))).toEqual({
      userId: "user-1",
      tenantId: "store-1",
      role: "stylist",
    });
    expect(actorFromAuthUser(makeUser("store_owner"))).toEqual({
      userId: "user-1",
      tenantId: "store-1",
      role: "salon_admin",
    });
  });
});
