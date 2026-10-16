import { NextResponse, type NextRequest } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import { handleStripeEvent } from "@/lib/stripe/webhook";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) return NextResponse.json({ error: "missing signature" }, { status: 400 });

  // İmza doğrulaması ham gövde üzerinde yapılır (JSON'a çevrilmeden)
  const body = await request.text();

  let event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  try {
    const result = await handleStripeEvent(event);
    return NextResponse.json({ received: true, result });
  } catch (err) {
    console.error(`[stripe] ${event.type} işlenemedi`, err);
    // 500: Stripe olayı otomatik olarak yeniden dener
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }
}
