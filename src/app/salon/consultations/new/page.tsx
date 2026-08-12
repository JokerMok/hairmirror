import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AUTH_COOKIE, getUserByToken } from "@/lib/auth";
import SalonConsultationFlow from "@/components/salon-consultation-flow";
import { STYLIST_CONSULTATION_PATH, loginPath } from "@/lib/entry-routes";

export default async function NewSalonConsultationPage({ searchParams }: { searchParams?: Promise<{ id?: string }> }) {
  const jar = await cookies();
  const user = getUserByToken(jar.get(AUTH_COOKIE)?.value);
  if (!user) redirect(loginPath(STYLIST_CONSULTATION_PATH));
  if (user.role === "personal") redirect("/salon");
  const params = searchParams ? await searchParams : {};
  return <main className="min-h-screen bg-slate-50 px-5 py-10 sm:px-8"><SalonConsultationFlow initialConsultationId={params.id} mode="stylist" /></main>;
}
