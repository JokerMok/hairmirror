import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowLeft, CalendarDays, ClipboardList } from "lucide-react";
import { AUTH_COOKIE, getUserByToken } from "@/lib/auth";
import { db } from "@/lib/database";
import {
  actorFromAuthUser,
  deleteExpiredConsultations,
  listConsultations,
} from "@/lib/consultation-access";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function ConsultationHistoryPage() {
  const jar = await cookies();
  const user = getUserByToken(jar.get(AUTH_COOKIE)?.value);
  if (!user) redirect("/login?next=/account/consultations");

  const database = db();
  deleteExpiredConsultations(database);
  const consultations = listConsultations(database, actorFromAuthUser(user));

  return (
    <main className="min-h-screen bg-[#f7f8f5] px-4 py-8 text-[#143c34] sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between border-b border-[#dce6e1] pb-5">
          <Link href="/account" className="inline-flex items-center gap-2 text-sm font-medium text-[#48736a] hover:text-[#166b5c]">
            <ArrowLeft size={16} /> Back to account
          </Link>
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6f8a83]">HairMirror</span>
        </header>

        <section className="rounded-3xl bg-[#143c34] p-7 text-white shadow-sm sm:p-10">
          <p className="text-sm font-medium text-[#b8d6ca]">Consultation history</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Your saved hairstyle consultations</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#d3e5df]">Consultation records are kept for 30 days and can be deleted at any time.</p>
        </section>

        <section className="mt-6 rounded-3xl border border-[#dce6e1] bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-3">
            <ClipboardList size={20} className="text-[#177761]" />
            <h2 className="text-xl font-semibold">Saved consultations</h2>
          </div>

          {consultations.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-[#cbd9d4] px-6 py-12 text-center">
              <p className="font-medium">No consultations yet</p>
              <p className="mt-2 text-sm text-[#6f817c]">Start a consultation to save analysis, recommendations, and execution notes here.</p>
              <Link href="/#studio" className="mt-5 inline-flex rounded-full bg-[#177761] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#105e4d]">Start a consultation</Link>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {consultations.map((consultation) => (
                <article key={consultation.id} className="rounded-2xl border border-[#dce6e1] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold">{consultation.recommendations.length} recommendations</p>
                      <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-[#6f817c]"><CalendarDays size={13} /> {formatDate(consultation.createdAt)}</p>
                    </div>
                    <span className="rounded-full bg-[#eaf4ef] px-3 py-1 text-xs font-semibold capitalize text-[#177761]">{consultation.status}</span>
                  </div>
                  {consultation.analysisResult && (
                    <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                      {Object.entries(consultation.analysisResult).slice(0, 3).map(([key, value]) => (
                        <div key={key} className="rounded-xl bg-[#f6f9f7] px-3 py-2">
                          <dt className="text-xs text-[#71857f]">{key.replaceAll("_", " ")}</dt>
                          <dd className="mt-1 font-medium">{typeof value === "string" || typeof value === "number" ? String(value) : "—"}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  {consultation.recommendations.length > 0 && (
                    <p className="mt-4 text-sm text-[#4b665e]">{consultation.recommendations.map((item) => item.styleName).join(" · ")}</p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
