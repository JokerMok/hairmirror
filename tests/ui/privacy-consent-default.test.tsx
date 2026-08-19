import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import SalonConsultationFlow from "@/components/salon-consultation-flow";
import { StudioWizard } from "@/components/studio-wizard";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => undefined }),
}));

describe("photo privacy consent defaults", () => {
  it("checks the consumer consent box on a new studio flow", () => {
    const markup = renderToStaticMarkup(<StudioWizard locale="en" />);

    expect(markup).toMatch(
      /type="checkbox"[^>]*checked=""[^>]*><span>I have the right to use this photo/,
    );
  });

  it("checks the salon consent box on a new consultation flow", () => {
    const markup = renderToStaticMarkup(<SalonConsultationFlow />);

    expect(markup).toMatch(
      /type="checkbox"[^>]*checked=""[^>]*><span>I confirm the client agreed to use this clear/,
    );
  });
});
