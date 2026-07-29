import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestUser, hashPassword } from "@/lib/auth";
import { db, findUserByEmail, findUserByPhone } from "@/lib/database";
import { safeRedirectUrl } from "@/lib/session";

export const runtime = "nodejs";
const schema = z
  .object({
    email: z.string().trim().toLowerCase().email().optional(),
    phone: z
      .string()
      .regex(/^1[3-9]\d{9}$/)
      .optional(),
    password: z.string().min(8).max(72),
    name: z.string().trim().min(2).max(30),
  })
  .refine((data) => Boolean(data.email || data.phone), {
    message: "IDENTIFIER_REQUIRED",
  });

export async function POST(request: NextRequest) {
  const owner = getRequestUser(request);
  if (!owner || owner.role !== "store_owner" || !owner.storeId)
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const contentType = request.headers.get("content-type") ?? "";
  const input = contentType.includes("application/json")
    ? await request.json().catch(() => null)
    : Object.fromEntries(await request.formData());
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  if (parsed.data.email && findUserByEmail(parsed.data.email))
    return NextResponse.json({ error: "EMAIL_EXISTS" }, { status: 409 });
  if (parsed.data.phone && findUserByPhone(parsed.data.phone))
    return NextResponse.json({ error: "PHONE_EXISTS" }, { status: 409 });
  const database = db();
  const userId = crypto.randomUUID();
  const now = new Date().toISOString();
  database.exec("BEGIN IMMEDIATE");
  try {
    database
      .prepare(
        "INSERT INTO users(id,phone,email,name,password_hash,role,status,created_at) VALUES(?,?,?,?,?,'staff','active',?)",
      )
      .run(
        userId,
        parsed.data.phone ?? `email-${userId}`,
        parsed.data.email ?? null,
        parsed.data.name,
        hashPassword(parsed.data.password),
        now,
      );
    database
      .prepare(
        "INSERT INTO store_members(store_id,user_id,created_at) VALUES(?,?,?)",
      )
      .run(owner.storeId, userId, now);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  if (!contentType.includes("application/json"))
    return NextResponse.redirect(
      safeRedirectUrl(request, "/account?member=created"),
      303,
    );
  return NextResponse.json({ created: true }, { status: 201 });
}
