import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RoleEntry, ROLE_STORAGE_KEY, rolePath } from "@/components/role-entry";

describe("role entry", () => {
  it("exposes both paths without a payment CTA", () => {
    const markup = renderToStaticMarkup(<RoleEntry locale="en" />);

    expect(markup).toContain("I’m a customer");
    expect(markup).toContain("I’m a stylist");
    expect(markup).toContain('href="/consumer"');
    expect(markup).toContain('href="/salon"');
    expect(markup).not.toContain("pricing");
    expect(markup).not.toContain("checkout");
  });

  it("keeps role routing deterministic and names its persistence key", () => {
    expect(rolePath("consumer")).toBe("/consumer");
    expect(rolePath("stylist")).toBe("/salon");
    expect(ROLE_STORAGE_KEY).toBe("hairmirror.role");
  });
});
