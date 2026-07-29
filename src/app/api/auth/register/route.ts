import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  authCookieOptions,
  AUTH_COOKIE,
  checkAuthRateLimit,
  createAuthSession,
  hashPassword,
} from "@/lib/auth";
import { db, findUserByEmail, findUserByPhone } from "@/lib/database";

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
    accountType: z.enum(["personal", "store_owner"]),
    storeName: z.string().trim().max(50).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.email && !data.phone)
      ctx.addIssue({
        code: "custom",
        path: ["email"],
        message: "IDENTIFIER_REQUIRED",
      });
    if (
      data.accountType === "store_owner" &&
      (!data.storeName || data.storeName.length < 2)
    )
      ctx.addIssue({
        code: "custom",
        path: ["storeName"],
        message: "STORE_NAME_REQUIRED",
      });
  });

export async function POST(request: NextRequest) {
  const client =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!checkAuthRateLimit(`register:${client}`, 5, 60 * 60 * 1000))
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
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
        "INSERT INTO users(id,phone,email,name,password_hash,role,status,created_at) VALUES(?,?,?,?,?,?,'active',?)",
      )
      .run(
        userId,
        parsed.data.phone ?? `email-${userId}`,
        parsed.data.email ?? null,
        parsed.data.name,
        hashPassword(parsed.data.password),
        parsed.data.accountType,
        now,
      );
    if (parsed.data.accountType === "store_owner") {
      const storeId = crypto.randomUUID();
      database
        .prepare(
          "INSERT INTO stores(id,name,owner_user_id,created_at) VALUES(?,?,?,?)",
        )
        .run(storeId, parsed.data.storeName!, userId, now);
      database
        .prepare(
          "INSERT INTO store_members(store_id,user_id,created_at) VALUES(?,?,?)",
        )
        .run(storeId, userId, now);
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  const token = createAuthSession(userId);
  const response = NextResponse.json({ created: true }, { status: 201 });
  response.cookies.set(AUTH_COOKIE, token, authCookieOptions);
  return response;
}
