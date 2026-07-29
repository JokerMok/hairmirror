import { NextRequest, NextResponse } from "next/server";
import {
  claimPaddleEvent,
  failPaddleEvent,
  finishPaddleEvent,
  paddleClient,
  syncPaddleAdjustment,
  syncPaddleSubscription,
  syncPaddleTransaction,
} from "@/lib/paddle-billing";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  const signature = request.headers.get("paddle-signature");
  if (!secret || !signature)
    return NextResponse.json({ error: "WEBHOOK_NOT_CONFIGURED" }, { status: 503 });
  let event: Awaited<ReturnType<ReturnType<typeof paddleClient>["webhooks"]["unmarshal"]>>;
  try {
    event = await paddleClient().webhooks.unmarshal(
      await request.text(),
      secret,
      signature,
    );
  } catch {
    return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 400 });
  }
  if (!claimPaddleEvent(event.eventId, event.eventType))
    return NextResponse.json({ received: true, duplicate: true });
  try {
    if (event.eventType === "transaction.completed")
      syncPaddleTransaction(event.data as Parameters<typeof syncPaddleTransaction>[0]);
    else if (event.eventType === "adjustment.updated")
      syncPaddleAdjustment(event.data as Parameters<typeof syncPaddleAdjustment>[0]);
    else if (event.eventType.startsWith("subscription."))
      syncPaddleSubscription(event.data as Parameters<typeof syncPaddleSubscription>[0]);
    finishPaddleEvent(event.eventId);
    return NextResponse.json({ received: true });
  } catch (error) {
    failPaddleEvent(event.eventId, error);
    return NextResponse.json({ error: "WEBHOOK_PROCESSING_FAILED" }, { status: 500 });
  }
}
