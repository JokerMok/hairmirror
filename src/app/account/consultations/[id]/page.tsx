import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import SalonConsultationFlow from "@/components/salon-consultation-flow";
import { AUTH_COOKIE, getUserByToken } from "@/lib/auth";
import { db } from "@/lib/database";
import { actorFromAuthUser, getPublicConsultation } from "@/lib/consultation-access";

export const dynamic = "force-dynamic";

export default async function ConsultationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = (await params).id;
  const jar = await cookies();
  const user = getUserByToken(jar.get(AUTH_COOKIE)?.value);
  if (!user) redirect(`/login?next=/account/consultations/${id}`);
  try {
    if (!getPublicConsultation(db(), id, actorFromAuthUser(user))) notFound();
  } catch {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#f7f8f5] px-4 py-8 text-[#143c34] sm:px-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/account/consultations" className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-[#48736a] hover:text-[#166b5c]">
          <ArrowLeft size={16} /> Back to consultation history
        </Link>
        <div className="mt-6 rounded-3xl border border-[#dce6e1] bg-white p-4 shadow-sm sm:p-8">
          <SalonConsultationFlow initialConsultationId={id} mode={user.role === "personal" ? "consumer" : "stylist"} />
        </div>
      </div>
    </main>
  );
}
