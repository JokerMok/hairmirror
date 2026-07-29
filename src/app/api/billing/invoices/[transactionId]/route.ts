import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, getUserByToken } from "@/lib/auth";
import { db } from "@/lib/database";
import { paddleClient } from "@/lib/paddle-billing";

export async function GET(request: NextRequest, context: { params: Promise<{ transactionId: string }> }) {
  const user = getUserByToken(request.cookies.get(AUTH_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { transactionId } = await context.params;
  const owned = db()
    .prepare("SELECT 1 FROM paddle_transactions WHERE transaction_id=? AND user_id=? AND status='completed'")
    .get(transactionId, user.id);
  if (!owned) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const invoice = await paddleClient().transactions.getInvoicePDF(transactionId);
  return NextResponse.redirect(invoice.url, 303);
}
