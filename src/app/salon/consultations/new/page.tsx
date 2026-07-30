import SalonConsultationFlow from "@/components/salon-consultation-flow";

export default async function NewSalonConsultationPage({ searchParams }: { searchParams?: Promise<{ id?: string }> }) {
  const params = searchParams ? await searchParams : {};
  return <main className="min-h-screen bg-slate-50 px-5 py-10 sm:px-8"><SalonConsultationFlow initialConsultationId={params.id} /></main>;
}
