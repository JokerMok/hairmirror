"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import Image from "next/image";
import CommunicationCard from "@/components/communication-card";
import { ProtectedResultImage } from "@/components/protected-result-image";
import type { CommunicationCardResponse } from "@/lib/communication-card";
import type {
  Consultation,
  ConsultationGenerationJob,
  Recommendation,
} from "@/lib/types";

type Props = { initialConsultationId?: string; mode?: "stylist" | "consumer" };

async function readJson(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) throw new Error(String(payload.error ?? "REQUEST_FAILED"));
  return payload;
}

const activeJob = (job: ConsultationGenerationJob | undefined) =>
  job?.status === "queued" || job?.status === "processing";

function readableError(error: unknown) {
  const code = error instanceof Error ? error.message : "REQUEST_FAILED";
  return {
    MODEL_UNAVAILABLE: "The image model is not available yet. The consultation is saved; try again when a model is enabled.",
    PAYMENT_REQUIRED: "This salon does not have generation access enabled yet.",
    SOURCE_EXPIRED: "The source photo is no longer available. Start a new consultation with the photo again.",
    CONSENT_REQUIRED: "Confirm that the client agreed to use this photo for hairstyle analysis.",
    SOURCE_IMAGE_QUALITY_INVALID: "Use one clear front-facing photo with at least 512 × 512 pixels.",
    CUSTOMER_NOT_FOUND: "No personal HairMirror account was found for that customer email.",
    ACCESS_REQUIRED: "This account does not have a preview set available yet.",
    RESULT_IMAGE_MISSING: "The model returned an incomplete preview. It was marked failed so you can retry safely.",
    INVALID_CONSULTATION_INPUT: "This consultation cannot be generated in its current state.",
  }[code] ?? "The generation request could not be completed. Please try again.";
}

function recommendationJob(
  recommendation: Recommendation,
  jobs: ConsultationGenerationJob[],
) {
  return jobs.find((job) => job.recommendationId === recommendation.id);
}

export default function SalonConsultationFlow({ initialConsultationId, mode = "stylist" }: Props) {
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [communicationCard, setCommunicationCard] = useState<CommunicationCardResponse | null>(null);
  const [jobs, setJobs] = useState<ConsultationGenerationJob[]>([]);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [customerEmail, setCustomerEmail] = useState("");

  function applyPayload(payload: Record<string, unknown>) {
    const item = payload.consultation as Consultation;
    setConsultation(item);
    setSelected(item.selectedRecommendationId);
    setJobs(item.generationJobs ?? []);
  }

  useEffect(() => {
    if (!initialConsultationId) return;
    let cancelled = false;
    fetch(`/api/consultations/${encodeURIComponent(initialConsultationId)}`, { cache: "no-store" })
      .then(readJson)
      .then((payload) => {
        if (!cancelled) applyPayload(payload);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(readableError(reason));
      });
    return () => { cancelled = true; };
  }, [initialConsultationId]);

  useEffect(() => {
    const consultationId = consultation?.id;
    if (!consultationId || !jobs.some(activeJob)) return;
    let cancelled = false;
    const timer = window.setInterval(() => {
      fetch(`/api/consultations/${encodeURIComponent(consultationId)}`, { cache: "no-store" })
        .then(readJson)
        .then((payload) => {
          if (!cancelled) applyPayload(payload);
        })
        .catch(() => undefined);
    }, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [consultation?.id, jobs]);

  useEffect(() => {
    if (!consultation?.selectedRecommendationId) return;
    let cancelled = false;
    fetch(`/api/consultations/${encodeURIComponent(consultation.id)}/communication-card`, { cache: "no-store" })
      .then(readJson)
      .then((payload) => {
        if (!cancelled) setCommunicationCard(payload as CommunicationCardResponse);
      })
      .catch(() => {
        if (!cancelled) setCommunicationCard(null);
      });
    return () => { cancelled = true; };
  }, [consultation?.id, consultation?.selectedRecommendationId]);

  const visibleCommunicationCard = consultation?.selectedRecommendationId &&
    communicationCard?.card.recommendationId === consultation.selectedRecommendationId
    ? communicationCard
    : null;
  const generating = jobs.some(activeJob);
  const statusLabel = useMemo(() => {
    if (!consultation) return "New consultation";
    if (generating) return "Generating previews";
    if (consultation.generationStatus === "partial") return "Some previews ready";
    if (consultation.generationStatus === "failed") return "Preview generation failed";
    if (consultation.generationStatus === "cancelled") return "Preview generation cancelled";
    if (consultation.status === "ready") return "Analysis ready";
    return consultation.status[0].toUpperCase() + consultation.status.slice(1);
  }, [consultation, generating]);

  async function patchConsultation(action: string, body: Record<string, unknown> = {}) {
    return readJson(await fetch(`/api/consultations/${consultation?.id ?? ""}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    }));
  }

  async function generatePreviews() {
    if (!consultation) return;
    setBusy(true);
    setError(null);
    try {
      applyPayload(await patchConsultation("generate"));
    } catch (reason) {
      setError(readableError(reason));
    } finally {
      setBusy(false);
    }
  }

  async function createAndAnalyze() {
    if (!photo) return;
    setBusy(true);
    setError(null);
    try {
      const idempotencyKey = crypto.randomUUID();
      const created = await readJson(await fetch("/api/consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ imageDataUrl: photo, idempotencyKey, consentAccepted, photoQualityConfirmed: consentAccepted, consentVersion: "hairmirror-photo-consent-v1", ...(mode === "stylist" && customerEmail.trim() ? { customerEmail: customerEmail.trim() } : {}) }),
      }));
      const draft = created.item as Consultation;
      const analyzed = await readJson(await fetch(`/api/consultations/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "analyze" }),
      }));
      applyPayload(analyzed);
      const generated = await readJson(await fetch(`/api/consultations/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate" }),
      }));
      applyPayload(generated);
    } catch (reason) {
      setError(readableError(reason));
    } finally {
      setBusy(false);
    }
  }

  async function chooseRecommendation(id: string) {
    if (!consultation) return;
    setBusy(true);
    setError(null);
    setSelected(id);
    try {
      applyPayload(await patchConsultation("select", { selectedRecommendationId: id }));
    } catch {
      setError("The selected direction could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function retryRecommendation(recommendationId: string) {
    if (!consultation) return;
    setBusy(true);
    setError(null);
    try {
      applyPayload(await patchConsultation("retry", { recommendationId }));
    } catch (reason) {
      setError(readableError(reason));
    } finally {
      setBusy(false);
    }
  }

  async function cancelRecommendation(recommendationId: string) {
    if (!consultation) return;
    setBusy(true);
    setError(null);
    try {
      applyPayload(await patchConsultation("cancel", { recommendationId }));
    } catch (reason) {
      setError(readableError(reason));
    } finally {
      setBusy(false);
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!(file.type === "image/jpeg" || file.type === "image/png" || file.type === "image/webp")) {
      setError("Please choose a JPG, PNG or WebP image.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Please choose an image under 8 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const image = new window.Image();
      image.onload = () => {
        if (image.width < 512 || image.height < 512) {
          setPhoto(null);
          setError("Use a photo at least 512 × 512 pixels so the hairstyle details remain usable.");
          return;
        }
        setError(null);
        setPhoto(result);
      };
      image.onerror = () => setError("The photo could not be read. Please choose another image.");
      image.src = result;
    };
    reader.readAsDataURL(file);
  }

  return (
    <section aria-labelledby="consultation-title" className="mx-auto min-w-0 max-w-5xl space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">{mode === "stylist" ? "Salon consultation" : "Personal consultation"}</p>
        <h1 id="consultation-title" className="text-4xl font-semibold tracking-tight text-slate-900">{initialConsultationId ? "Consultation details" : mode === "stylist" ? "Create a client consultation" : "Create your consultation"}</h1>
        <p className="max-w-2xl text-slate-600">{mode === "stylist" ? "Turn a client photo into a clear recommendation and a haircut brief your stylist can execute." : "Compare practical hairstyle directions before your next appointment, then save the brief for your stylist."}</p>
      </header>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold text-slate-900">1. {mode === "stylist" ? "Client photo" : "Your photo"}</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{statusLabel}</span></div>
          <label htmlFor="consultation-photo" className="flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center hover:border-emerald-500 focus-within:border-emerald-500">
            {photo ? <Image src={photo} alt="Client source preview" width={640} height={800} unoptimized className="max-h-72 max-w-full rounded-xl object-contain" /> : <><span className="text-lg font-medium text-slate-900">Upload a clear front-facing photo</span><span className="mt-2 text-sm text-slate-500">JPG, PNG or WebP · up to 8 MB</span></>}
            <input id="consultation-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={onFileChange} className="sr-only" />
          </label>
          {mode === "stylist" && <input value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} placeholder="Optional customer email to attach this record" type="email" className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none ring-emerald-500 focus:ring-2" />}
          {!initialConsultationId && <label className="mt-4 flex items-start gap-3 rounded-xl bg-amber-50 p-3 text-sm leading-5 text-amber-950"><input type="checkbox" checked={consentAccepted} onChange={(event) => setConsentAccepted(event.target.checked)} className="mt-1 size-4 accent-emerald-700" /><span>{mode === "stylist" ? "I confirm the client agreed to use this clear, front-facing photo of one person for hairstyle analysis. The photo is not used for model training." : "I agree to use this clear, front-facing photo of one person for hairstyle analysis. The photo is not used for model training and can be deleted with this consultation."}</span></label>}
          <button type="button" onClick={createAndAnalyze} disabled={!photo || busy || Boolean(initialConsultationId) || !consentAccepted} className="mt-5 w-full rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300">{busy ? "Working…" : initialConsultationId ? "Saved consultation" : "Analyze and generate previews"}</button>
          {consultation?.analysisResult && jobs.length === 0 && <button type="button" onClick={generatePreviews} disabled={busy} className="mt-3 w-full rounded-xl border border-emerald-700 px-4 py-3 font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60">Generate previews</button>}
          {error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
        </div>

        <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" aria-live="polite">
          <h2 className="text-xl font-semibold text-slate-900">2. Recommendations and previews</h2>
          {!consultation?.analysisResult ? <p className="mt-8 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">Upload a photo and run the analysis to see three directions.</p> : <>
            {consultation.analysisResult.source === "fallback" && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-5 text-amber-950"><strong>Safe starting point.</strong> The analysis service was unavailable or returned unusable data{consultation.analysisResult.reason ? ` (${String(consultation.analysisResult.reason)})` : ""}. Confirm the direction with a stylist before cutting.</div>}
            {consultation.analysisResult.status === "low_confidence" && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-5 text-amber-950"><strong>Low confidence.</strong> {String(consultation.analysisResult.explanation ?? "Use these as starting options and confirm them with a stylist.")}</div>}
            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">{Object.entries(consultation.analysisResult).filter(([key]) => !["source", "reason", "explanation"].includes(key)).slice(0, 4).map(([key, value]) => <div key={key} className="min-w-0 rounded-xl bg-slate-50 p-3"><dt className="truncate text-slate-500">{key.replaceAll("_", " ")}</dt><dd className="mt-1 break-words font-medium capitalize text-slate-900">{String(value)}</dd></div>)}</dl>
            <div className="mt-5 space-y-4">{consultation.recommendations.map((recommendation) => {
              const job = recommendationJob(recommendation, jobs);
              const loading = activeJob(job);
              return <article key={recommendation.id} className={`min-w-0 overflow-hidden rounded-2xl border p-4 ${selected === recommendation.id ? "border-emerald-600 bg-emerald-50" : "border-slate-200"}`}>
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-semibold text-slate-900">{recommendation.styleName}</h3><p className="mt-1 text-sm text-slate-600">{recommendation.rationale}</p></div><span className="shrink-0 text-xs font-semibold text-slate-500">#{recommendation.rank}</span></div>
                <div className="relative mt-4 aspect-[4/5] overflow-hidden rounded-xl bg-slate-100">
                  {recommendation.imageUrl ? <ProtectedResultImage src={recommendation.imageUrl} alt={`${recommendation.styleName} preview`} retryLabel="Reload image" errorLabel="The preview could not be loaded." /> : loading ? <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-slate-600"><span>{job?.status === "processing" ? "Generating this preview…" : "Waiting in the generation queue…"}</span></div> : job?.status === "failed" ? <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-rose-700"><span>Generation failed{job.errorCode ? `: ${job.errorCode}` : "."}</span></div> : job?.status === "cancelled" ? <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-slate-600"><span>Generation cancelled.</span></div> : <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-slate-500">Preview not generated yet.</div>}
                </div>
                <p className="mt-3 text-sm text-slate-700"><strong>Execution:</strong> {Object.values(recommendation.execution).filter(Boolean).join(" · ")}</p>
                <button type="button" onClick={() => chooseRecommendation(recommendation.id)} disabled={busy || consultation.status === "completed"} className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-emerald-600 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">{selected === recommendation.id ? "Selected" : "Save this direction"}</button>
                {loading && <button type="button" onClick={() => cancelRecommendation(recommendation.id)} disabled={busy} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:border-rose-500 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-60">Cancel generation</button>}
                {job?.status === "failed" && <button type="button" onClick={() => retryRecommendation(recommendation.id)} disabled={busy} className="mt-2 w-full rounded-lg border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60">Retry generation</button>}
              </article>;
            })}</div>
            {visibleCommunicationCard && <div className="mt-6"><CommunicationCard card={visibleCommunicationCard.card} markdown={visibleCommunicationCard.markdown} /></div>}
          </>}
        </div>
      </div>
    </section>
  );
}
