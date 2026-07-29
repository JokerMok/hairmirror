import { afterEach, describe, expect, it } from "vitest";
import { billingCatalog } from "./billing";

afterEach(() => {
  for (const key of [
    "BILLING_PROVIDER",
    "GUMROAD_PERSONAL_PRODUCT_ID",
    "GUMROAD_SALON_PRODUCT_ID",
    "GUMROAD_PERSONAL_MONTHLY_PRICE_USD",
    "GUMROAD_SALON_MONTHLY_PRICE_USD",
  ])
    delete process.env[key];
});

describe("Gumroad billing catalog", () => {
  it("shows configured monthly USD prices", async () => {
    process.env.BILLING_PROVIDER = "gumroad";
    process.env.GUMROAD_PERSONAL_PRODUCT_ID = "personal-product";
    process.env.GUMROAD_SALON_PRODUCT_ID = "salon-product";
    process.env.GUMROAD_PERSONAL_MONTHLY_PRICE_USD = "9";
    process.env.GUMROAD_SALON_MONTHLY_PRICE_USD = "29";

    const catalog = await billingCatalog("en");

    expect(
      catalog.map(({ key, unitAmount, currency, interval }) => ({
        key,
        unitAmount,
        currency,
        interval,
      })),
    ).toEqual([
      {
        key: "salon_pro",
        unitAmount: 2900,
        currency: "usd",
        interval: "month",
      },
    ]);
  });
});
