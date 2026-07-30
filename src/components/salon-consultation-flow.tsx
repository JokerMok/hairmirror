"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import type { Consultation } from "@/lib/types";

type Props = { initialConsultationId?: string };

async function readJson(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) throw new Error(String(payload.error ?? "REQUEST_FAILED"));
  return payload;
}

export default function SalonConsultationFlow({ initialConsultationId }: Props) {
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!initialConsultationId) return;
    let cancelled = false;
    fetch(`/api/consultations/${encodeURIComponent(initialConsultationId)}`, { cache: "no-store" })
      .then(readJson)
      .then((payload) => {
        if (!cancelled) {
          const item = payload.consultation as Consultation;
          setConsultation(item);
          setSelected(item.selectedRecommendationId);
        }
      })
      .catch((reason: unknown) => !cancelled && setError(String(reason instanceof Error ? reason.message : reason)))
    return () => { cancelled = true; };
  }, [initialConsultationId]);

  const statusLabel = useMemo(() => {
    if (!consultation) return "New consultation";
    return consultation.status === "ready" ? "Analysis ready" : consultation.status[0].toUpperCase() + consultation.status.slice(1);
  }, [consultation]);

  async function createAndAnalyze() {
    if (!photo) return;
    setBusy(true); setError(null);
    try {
      const idempotencyKey = crypto.randomUUID();
      const created = await readJson(await fetch("/api/consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ imageDataUrl: photo, idempotencyKey }),
      }));
      const draft = created.item as Consultation;
      const analyzed = await readJson(await fetch(`/api/consultations/${draft.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "analyze" }),
      }));
      setConsultation(analyzed.consultation as Consultation);
    } catch (reason) {
      setError(reason instanceof Error && reason.message === "UNAUTHENTICATED" ? "Sign in as a stylist to create a consultation." : "We could not create this consultation. Please try again.");
    } finally { setBusy(false); }
  }

  async function chooseRecommendation(id: string) {
    if (!consultation) return;
    setBusy(true); setError(null); setSelected(id);
    try {
      const payload = await readJson(await fetch(`/api/consultations/${consultation.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "select", selectedRecommendationId: id }),
      }));
      setConsultation(payload.consultation as Consultation);
    } catch { setError("The selected direction could not be saved."); } finally { setBusy(false); }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { setError("Please choose an image under 8 MB."); return; }
    const reader = new FileReader(); reader.onload = () => setPhoto(String(reader.result)); reader.readAsDataURL(file);
  }

  return (
    <section aria-labelledby="consultation-title" className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">Salon consultation</p>
        <h1 id="consultation-title" className="text-4xl font-semibold tracking-tight text-slate-900">Create a consultation</h1>
        <p className="max-w-2xl text-slate-600">Turn a client photo into a clear recommendation and a haircut brief your stylist can execute.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-semibold text-slate-900">1. Client photo</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{statusLabel}</span></div>
          <label htmlFor="consultation-photo" className="flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center hover:border-emerald-500 focus-within:border-emerald-500">
            {photo ? <img src={photo} alt="Client source preview" className="max-h-72 rounded-xl object-contain" /> : <><span className="text-lg font-medium text-slate-900">Upload a clear front-facing photo</span><span className="mt-2 text-sm text-slate-500">JPG, PNG or WebP · up to 8 MB</span></>}
            <input id="consultation-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={onFileChange} className="sr-only" />
          </label>
          <button type="button" onClick={createAndAnalyze} disabled={!photo || busy} className="mt-5 w-full rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300">{busy ? "Working…" : consultation ? "Analyze again" : "Analyze hairstyle"}</button>
          {error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" aria-live="polite">
          <h2 className="text-xl font-semibold text-slate-900">2. AI recommendation</h2>
          {!consultation?.analysisResult ? <p className="mt-8 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">Upload a photo and run the analysis to see three directions.</p> : <>
            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">{Object.entries(consultation.analysisResult).slice(0, 4).map(([key, value]) => <div key={key} className="rounded-xl bg-slate-50 p-3"><dt className="text-slate-500">{key.replaceAll("_", " ")}</dt><dd className="mt-1 font-medium capitalize text-slate-900">{String(value)}</dd></div>)}</dl>
            <div className="mt-5 space-y-3">{consultation.recommendations.map((recommendation) => <article key={recommendation.id} className={`rounded-2xl border p-4 ${selected === recommendation.id ? "border-emerald-600 bg-emerald-50" : "border-slate-200"}`}><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-900">{recommendation.styleName}</h3><p className="mt-1 text-sm text-slate-600">{recommendation.rationale}</p></div><span className="text-xs font-semibold text-slate-500">#{recommendation.rank}</span></div><p className="mt-3 text-sm text-slate-700"><strong>Execution:</strong> {Object.values(recommendation.execution).filter(Boolean).join(" · ")}</p><button type="button" onClick={() => chooseRecommendation(recommendation.id)} disabled={busy || consultation.status === "completed"} className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-emerald-600 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">{selected === recommendation.id ? "Selected" : "Save this direction"}</button></article>)}</div>
          </>}
        </div>
      </div>
    </section>
  );
}
