import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getRequestUser } from "@/lib/auth";
import { findUserByEmail, db } from "@/lib/database";
import { persistSourceImage, inspectSourceImage } from "@/lib/source-storage";
import { ConsultationDomainError, assertTenantForSalon } from "@/lib/consultation-domain";
import { actorFromAuthUser, getPublicConsultation, listConsultations } from "@/lib/consultation-access";
import { actorForUser, consultationIdForKey, createDraft, ensureSalon, findConsultation } from "./_repository";

export const runtime = "nodejs";
const CONSENT_VERSION = "hairmirror-photo-consent-v1";

function errorResponse(e: unknown) {
  const code = e instanceof ConsultationDomainError ? e.code : e instanceof Error && e.message === "INVALID_SOURCE_IMAGE" ? "INVALID_CONSULTATION_INPUT" : "INVALID_CONSULTATION_INPUT";
  const status = code === "TENANT_REQUIRED" || code === "CONSULTATION_FORBIDDEN" ? 403 : code === "CUSTOMER_NOT_FOUND" ? 404 : code === "CONSENT_REQUIRED" || code === "SOURCE_IMAGE_QUALITY_INVALID" ? 422 : 400;
  return NextResponse.json({ error: code }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  return NextResponse.json({ consultations: listConsultations(db(), actorFromAuthUser(user)) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  try {
    const actor = actorForUser(user);
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const imageDataUrl = typeof body.imageDataUrl === "string" ? body.imageDataUrl : "";
    if (!imageDataUrl.trim()) throw new ConsultationDomainError("INVALID_CONSULTATION_INPUT");
    if (body.consentAccepted !== true) throw new ConsultationDomainError("CONSENT_REQUIRED");
    if (body.photoQualityConfirmed !== true) throw new ConsultationDomainError("SOURCE_IMAGE_QUALITY_INVALID");
    const quality = inspectSourceImage(imageDataUrl);
    if (!quality.passed) throw new ConsultationDomainError("SOURCE_IMAGE_QUALITY_INVALID");

    const key = String(body.idempotencyKey ?? request.headers.get("Idempotency-Key") ?? "");
    const existingKey = key.length >= 8 ? key : undefined;
    const database = db();
    let salonId: string | null = null;
    let stylistUserId: string | null = null;
    let customerUserId: string | null = null;
    let scope = `consumer:${user.id}`;
    if (actor.role === "consumer") {
      customerUserId = user.id;
    } else {
      salonId = assertTenantForSalon(actor);
      stylistUserId = user.id;
      scope = salonId;
      ensureSalon(salonId, user);
      const suppliedCustomerId = typeof body.customerUserId === "string" && body.customerUserId.trim() ? body.customerUserId.trim() : null;
      const suppliedCustomerEmail = typeof body.customerEmail === "string" ? body.customerEmail.trim().toLowerCase() : "";
      const customer = suppliedCustomerId
        ? database.prepare("SELECT id,role FROM users WHERE id=?").get(suppliedCustomerId) as { id?: string; role?: string } | undefined
        : suppliedCustomerEmail
          ? findUserByEmail(suppliedCustomerEmail) as { id?: string; role?: string } | undefined
          : undefined;
      if (customer && customer.role !== "personal") throw new ConsultationDomainError("CUSTOMER_NOT_FOUND");
      if (suppliedCustomerId || suppliedCustomerEmail) {
        if (!customer?.id || customer.role !== "personal") throw new ConsultationDomainError("CUSTOMER_NOT_FOUND");
        customerUserId = String(customer.id);
      }
    }

    const id = existingKey ? consultationIdForKey(scope, existingKey) : randomUUID();
    const existing = findConsultation(id);
    if (existing) {
      const item = getPublicConsultation(database, id, actorFromAuthUser(user));
      return NextResponse.json({ item, created: false }, { status: 200 });
    }
    const stored = persistSourceImage(imageDataUrl, id);
    const result = createDraft({
      id,
      salonId,
      stylistUserId,
      customerUserId,
      sourcePhotoPath: stored.path,
      sourceConsentAt: new Date().toISOString(),
      sourceConsentVersion: CONSENT_VERSION,
      sourceQuality: quality,
    });
    const item = getPublicConsultation(database, result.item.id, actorFromAuthUser(user));
    return NextResponse.json({ item, created: result.created }, { status: result.created ? 201 : 200 });
  } catch (e) {
    return errorResponse(e);
  }
}
