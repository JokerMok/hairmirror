import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  markStripeEvent,
  stripeClient,
  stripeEventProcessed,
  syncSubscription,
} from "@/lib/billing";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature)
    return NextResponse.json(
      { error: "WEBHOOK_NOT_CONFIGURED" },
      { status: 503 },
    );
  let event: Stripe.Event;
  try {
    event = stripeClient().webhooks.constructEvent(
      await request.text(),
      signature,
      secret,
    );
  } catch {
    return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 400 });
  }
  try {
    if (stripeEventProcessed(event.id))
      return NextResponse.json({ received: true, duplicate: true });
    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    )
      syncSubscription(event.data.object as Stripe.Subscription);
    else if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (typeof session.subscription === "string")
        syncSubscription(
          await stripeClient().subscriptions.retrieve(session.subscription),
        );
    }
    markStripeEvent(event);
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json(
      { error: "WEBHOOK_PROCESSING_FAILED" },
      { status: 500 },
    );
  }
}
