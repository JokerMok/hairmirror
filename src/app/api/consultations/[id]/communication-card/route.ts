import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { buildCommunicationCard, toCommunicationCardMarkdown } from "@/lib/communication-card";
import { ConsultationDomainError } from "@/lib/consultation-domain";
import { actorForUser, requireConsultation } from "../../_repository";

export const runtime = "nodejs";

function fail(error: unknown) {
  const code = error instanceof ConsultationDomainError ? error.code : "INVALID_CONSULTATION_INPUT";
  const status = code === "CONSULTATION_NOT_FOUND" ? 404 : code === "CONSULTATION_FORBIDDEN" ? 403 : 400;
  return NextResponse.json({ error: code }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = getRequestUser(request);
    if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    const { id } = await params;
    const consultation = await requireConsultation(id, actorForUser(user));
    const card = buildCommunicationCard(consultation);
    return NextResponse.json(
      { card, markdown: toCommunicationCardMarkdown(card) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return fail(error);
  }
}
