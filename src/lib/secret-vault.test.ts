import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, maskSecret } from "./secret-vault";

describe("model secret vault", () => {
  it("encrypts authenticated payloads and decrypts them", () => {
    const encrypted = encryptSecret("sk-sensitive-demo-1234");
    expect(encrypted).not.toContain("sensitive");
    expect(decryptSecret(encrypted)).toBe("sk-sensitive-demo-1234");
    expect(maskSecret("sk-sensitive-demo-1234")).toBe("••••1234");
  });
  it("rejects tampered payloads", () => {
    const encrypted = encryptSecret("secret");
    expect(() => decryptSecret(`${encrypted.slice(0, -1)}x`)).toThrow();
  });
});
