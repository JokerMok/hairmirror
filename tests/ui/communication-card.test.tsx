import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import CommunicationCard from "@/components/communication-card";
import type { CommunicationCard as CommunicationCardData } from "@/lib/communication-card";

const card: CommunicationCardData = { consultationId: "c1", recommendationId: "r1", styleName: "Textured Crop", goal: "Daily wear", whyItFits: "Balances facial length.", instructions: { sides: "Low fade", top: "5cm", texture: "Medium", style: "Natural" }, upkeep: "1 min daily styling", confirmationPrompts: ["Confirm sides", "Confirm top", "Confirm upkeep"] };

describe("communication card UI", () => {
  it("renders execution details and a copy action", () => {
    const html = renderToStaticMarkup(<CommunicationCard card={card} markdown="# Haircut consultation" />);
    expect(html).toContain("Client communication card");
    expect(html).toContain("Low fade");
    expect(html).toContain("Copy card");
    expect(html).toContain("aria-label=\"Copy communication card\"");
  });
});
