import { describe, expect, it } from "vitest";
import { formatCost, formatCostSummary } from "./currency";

describe("currency cost formatting", () => {
  it("formats USD without a yuan symbol", () => {
    expect(formatCost(45_000, "USD")).toBe("$0.0450");
    expect(formatCostSummary(45_000, "USD")).toBe("USD $0.0450");
  });

  it("formats CNY with the yuan symbol", () => {
    expect(formatCost(1_050_000, "CNY")).toBe("¥1.0500");
    expect(formatCostSummary(1_050_000, "CNY")).toBe("CNY ¥1.0500");
  });

  it("keeps an explicit code for unsupported currencies", () => {
    expect(formatCost(12_345, "AUD")).toBe("AUD 0.0123");
  });
});
