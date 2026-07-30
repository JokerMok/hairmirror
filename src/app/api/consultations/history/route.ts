import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { db } from "@/lib/database";
import {
  actorFromAuthUser,
  deleteExpiredConsultations,
  getConsultation,
  listConsultations,
} from "@/lib/consultation-access";
import { ConsultationDomainError, assertConsultationAccess } from "@/lib/consultation-domain";

export const runtime = "nodejs";

function errorResponse(error: unknown) {
  const code = error instanceof ConsultationDomainError ? error.code : "INVALID_CONSULTATION_INPUT";
  const status = code === "CONSULTATION_FORBIDDEN" ? 403 : code === "CONSULTATION_NOT_FOUND" ? 404 : 400;
  return NextResponse.json({ error: code }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const database = db();
  deleteExpiredConsultations(database);
  return NextResponse.json(
    { consultations: listConsultations(database, actorFromAuthUser(user)) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id : request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "INVALID_CONSULTATION_INPUT" }, { status: 400 });
    const database = db();
    const consultation = getConsultation(database, id);
    if (!consultation) throw new ConsultationDomainError("CONSULTATION_NOT_FOUND");
    assertConsultationAccess(actorFromAuthUser(user), consultation);
    database.prepare("DELETE FROM consultations WHERE id=?").run(id);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
