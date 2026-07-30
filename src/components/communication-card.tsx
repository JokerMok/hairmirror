"use client";

import { useState } from "react";
import type { CommunicationCard as CommunicationCardData } from "@/lib/communication-card";

type Props = { card: CommunicationCardData; markdown: string };

export default function CommunicationCard({ card, markdown }: Props) {
  const [status, setStatus] = useState<string>("");

  async function copyCard() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(markdown);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = markdown;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }
      setStatus("Copied to clipboard");
    } catch {
      setStatus("Copy failed. Please select the card text manually.");
    }
  }

  return (
    <section aria-labelledby="communication-card-title" className="rounded-3xl border border-emerald-200 bg-emerald-950 p-6 text-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">Client communication card</p>
          <h2 id="communication-card-title" className="mt-2 text-2xl font-semibold">{card.styleName}</h2>
          <p className="mt-1 text-sm text-emerald-100">{card.goal} · {card.whyItFits}</p>
        </div>
        <button type="button" onClick={copyCard} aria-label="Copy communication card" className="rounded-xl bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-amber-200 focus:ring-offset-2 focus:ring-offset-emerald-950">Copy card</button>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {(Object.entries(card.instructions) as Array<[string, string]>).map(([label, value]) => <div key={label} className="rounded-2xl bg-white/10 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-emerald-200">{label}</p><p className="mt-2 text-sm text-white">{value}</p></div>)}
      </div>
      <p className="mt-5 text-sm text-emerald-50"><strong>Upkeep:</strong> {card.upkeep}</p>
      <div className="mt-5 rounded-2xl border border-white/15 bg-white/5 p-4"><p className="text-sm font-semibold text-white">Confirm before starting</p><ul className="mt-2 space-y-1 text-sm text-emerald-50">{card.confirmationPrompts.map((prompt) => <li key={prompt}>• {prompt}</li>)}</ul></div>
      <p aria-live="polite" className="mt-3 min-h-5 text-xs text-amber-200">{status}</p>
    </section>
  );
}
