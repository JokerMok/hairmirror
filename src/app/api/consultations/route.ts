import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getRequestUser } from "@/lib/auth";
import { persistSourceImage } from "@/lib/source-storage";
import { ConsultationDomainError, assertTenantForSalon } from "@/lib/consultation-domain";
import { db } from "@/lib/database";
import { actorFromAuthUser, getPublicConsultation, listConsultations } from "@/lib/consultation-access";
import { actorForUser, consultationIdForKey, createDraft, ensureSalon, findConsultation } from "./_repository";
export const runtime = "nodejs";
const error = (e: unknown) => { const code=e instanceof ConsultationDomainError?e.code:"INVALID_CONSULTATION_INPUT"; const status=code==="TENANT_REQUIRED"?403:400; return NextResponse.json({error:code},{status,headers:{"Cache-Control":"no-store"}}); };
export async function GET(request: NextRequest) { const user=getRequestUser(request); if(!user) return NextResponse.json({error:"UNAUTHENTICATED"},{status:401}); const database=db(); return NextResponse.json({consultations:listConsultations(database,actorFromAuthUser(user))},{headers:{"Cache-Control":"no-store"}}); }
export async function POST(request: NextRequest) {
 const user=getRequestUser(request); if(!user) return NextResponse.json({error:"UNAUTHENTICATED"},{status:401});
 try { const actor=actorForUser(user); const salonId=assertTenantForSalon(actor); if(actor.role==="consumer") throw new ConsultationDomainError("CONSULTATION_FORBIDDEN"); const body=await request.json() as Record<string,unknown>; const key=String(body.idempotencyKey ?? request.headers.get("Idempotency-Key") ?? ""); const existingKey=key.length>=8?key:undefined; ensureSalon(salonId,user); const id=existingKey ? consultationIdForKey(salonId,existingKey) : randomUUID(); const database=db(); const existing=findConsultation(id); if(existing) { const item=getPublicConsultation(database,id,actorFromAuthUser(user)); return NextResponse.json({item,created:false},{status:200}); } const customerUserId=typeof body.customerUserId==="string"&&body.customerUserId.trim()?body.customerUserId.trim():null; if(customerUserId){ const customer=database.prepare("SELECT role FROM users WHERE id=?").get(customerUserId) as {role?:string}|undefined; if(!customer||customer.role!=="personal") throw new ConsultationDomainError("INVALID_CONSULTATION_INPUT"); } const imageDataUrl=typeof body.imageDataUrl==="string"?body.imageDataUrl:undefined; const stored=persistSourceImage(imageDataUrl,id); const result=createDraft({id,salonId,stylistUserId:user.id,customerUserId,sourcePhotoPath:stored.path}); const item=getPublicConsultation(database,result.item.id,actorFromAuthUser(user)); return NextResponse.json({item,created:result.created},{status:result.created?201:200}); } catch(e) { return error(e); }
}
