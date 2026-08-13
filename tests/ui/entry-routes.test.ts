import { describe, expect, it } from "vitest";
import {
  loginPath,
  salonStartPath,
  STYLIST_CONSULTATION_PATH,
} from "@/lib/entry-routes";

describe("entry routes", () => {
  it("sends an authenticated stylist to the V0.3 consultation flow", () => {
    expect(STYLIST_CONSULTATION_PATH).toBe("/salon/consultations/new");
  });

  it("preserves the intended destination through login", () => {
    expect(loginPath(STYLIST_CONSULTATION_PATH)).toBe(
      "/login?next=%2Fsalon%2Fconsultations%2Fnew",
    );
  });

  it("does not loop personal users through the stylist flow", () => {
    expect(salonStartPath("personal")).toBe("/consumer");
    expect(salonStartPath("store_owner")).toBe(STYLIST_CONSULTATION_PATH);
    expect(salonStartPath("staff")).toBe(STYLIST_CONSULTATION_PATH);
    expect(salonStartPath(null)).toBe(STYLIST_CONSULTATION_PATH);
  });
});
