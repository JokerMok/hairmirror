import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, getUserByToken } from "@/lib/auth";
import { loginPath } from "@/lib/entry-routes";
import SalonConsultationFlow from "@/components/salon-consultation-flow";

export default async function NewConsumerConsultationPage({ searchParams }: { searchParams?: Promise<{ id?: string }> }) {
  const jar = await cookies();
  const user = getUserByToken(jar.get(AUTH_COOKIE)?.value);
  if (!user) redirect(loginPath("/consumer/consultations/new"));
  if (user.role !== "personal") redirect("/salon/consultations/new");
  const params = searchParams ? await searchParams : {};
  return <main className="min-h-screen bg-slate-50 px-5 py-10 sm:px-8"><SalonConsultationFlow initialConsultationId={params.id} mode="consumer" /></main>;
}
