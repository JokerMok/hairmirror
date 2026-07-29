import { describe, expect, it } from "vitest";
import { checkAuthRateLimit, hashPassword, verifyPassword } from "./auth";

describe("password security", () => {
  it("hashes with a random salt and verifies the original password", () => {
    const first = hashPassword("secure-pass-123");
    const second = hashPassword("secure-pass-123");
    expect(first).not.toBe(second);
    expect(verifyPassword("secure-pass-123", first)).toBe(true);
    expect(verifyPassword("wrong-pass", first)).toBe(false);
  });
  it("rejects malformed stored hashes", () => {
    expect(verifyPassword("anything", "broken")).toBe(false);
  });
});

describe("auth rate limiting", () => {
  it("blocks attempts above the configured window limit", () => {
    expect(checkAuthRateLimit("test-key", 2, 1000, 100)).toBe(true);
    expect(checkAuthRateLimit("test-key", 2, 1000, 200)).toBe(true);
    expect(checkAuthRateLimit("test-key", 2, 1000, 300)).toBe(false);
    expect(checkAuthRateLimit("test-key", 2, 1000, 1201)).toBe(true);
  });
});
