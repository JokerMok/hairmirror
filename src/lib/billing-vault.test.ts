import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptBillingSecret, encryptBillingSecret } from "./billing-vault";

beforeEach(() => {
  process.env.BILLING_SECRET_KEY = Buffer.alloc(32, 7).toString("base64");
});

afterEach(() => {
  delete process.env.BILLING_SECRET_KEY;
});

describe("billing secret vault", () => {
  it("encrypts license keys with authenticated encryption", () => {
    const encrypted = encryptBillingSecret("AAAA-BBBB-CCCC-DDDD");
    expect(encrypted).not.toContain("AAAA-BBBB");
    expect(decryptBillingSecret(encrypted)).toBe("AAAA-BBBB-CCCC-DDDD");
  });

  it("rejects a modified ciphertext", () => {
    const encrypted = encryptBillingSecret("AAAA-BBBB-CCCC-DDDD");
    const parts = encrypted.split(".");
    const ciphertext = Buffer.from(parts[3], "base64url");
    ciphertext[0] ^= 1;
    parts[3] = ciphertext.toString("base64url");
    expect(() => decryptBillingSecret(parts.join("."))).toThrow();
  });
});
