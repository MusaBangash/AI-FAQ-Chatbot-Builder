// app/api/stripe/route.js
// Three Stripe endpoints: create checkout, open portal, handle webhook

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@clerk/nextjs";
import { pool } from "@/lib/db";
import { PLANS } from "@/lib/plans";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ─── POST /api/stripe ─────────────────────────────────────────────
// action: "checkout" | "portal"
export async function POST(req) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action, plan } = await req.json();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  // ── Create checkout session ──────────────────────────────────────
  if (action === "checkout") {
    const planConfig = PLANS[plan];
    if (!planConfig) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });

    // Get or create Stripe customer
    const customerId = await getOrCreateStripeCustomer(userId);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [{ price: planConfig.priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard?upgraded=true`,
      cancel_url: `${appUrl}/billing`,
      metadata: { userId, plan },
      subscription_data: { metadata: { userId, plan } },
    });

    return NextResponse.json({ url: session.url });
  }

  // ── Open customer portal (manage/cancel) ────────────────────────
  if (action === "portal") {
    const customerId = await getStripeCustomerId(userId);
    if (!customerId) return NextResponse.json({ error: "No subscription found" }, { status: 404 });

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/billing`,
    });

    return NextResponse.json({ url: portal.url });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

// ─── Webhook handler ──────────────────────────────────────────────
// POST /api/stripe/webhook
export async function handleWebhook(req) {
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return new Response(`Webhook error: ${err.message}`, { status: 400 });
  }

  switch (event.type) {
    // New subscription created
    case "checkout.session.completed": {
      const session = event.data.object;
      const { userId, plan } = session.metadata;
      await upsertSubscription(userId, plan, session.customer, session.subscription);
      break;
    }

    // Subscription upgraded / downgraded
    case "customer.subscription.updated": {
      const sub = event.data.object;
      const userId = sub.metadata.userId;
      const plan = sub.metadata.plan;
      if (userId && plan) {
        await upsertSubscription(userId, plan, sub.customer, sub.id);
      }
      break;
    }

    // Subscription cancelled
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const userId = sub.metadata.userId;
      if (userId) {
        await pool.query(
          `UPDATE subscriptions SET plan = 'starter', chatbot_limit = 1, message_limit = 500
           WHERE user_id = $1`,
          [userId]
        );
      }
      break;
    }

    // Monthly usage reset
    case "invoice.payment_succeeded": {
      const invoice = event.data.object;
      if (invoice.billing_reason === "subscription_cycle") {
        const sub = await stripe.subscriptions.retrieve(invoice.subscription);
        const userId = sub.metadata.userId;
        if (userId) {
          await pool.query(
            "UPDATE subscriptions SET messages_used = 0 WHERE user_id = $1",
            [userId]
          );
          console.log(`✅ Reset message usage for ${userId}`);
        }
      }
      break;
    }
  }

  return new Response("ok", { status: 200 });
}

// ─── Helpers ──────────────────────────────────────────────────────

async function upsertSubscription(userId, plan, customerId, stripeSubId) {
  const planConfig = PLANS[plan] || PLANS.starter;
  await pool.query(
    `INSERT INTO subscriptions (id, user_id, plan, stripe_customer_id, stripe_subscription_id, chatbot_limit, message_limit, messages_used, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 0, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       plan = $2,
       stripe_customer_id = $3,
       stripe_subscription_id = $4,
       chatbot_limit = $5,
       message_limit = $6,
       updated_at = NOW()`,
    [userId, plan, customerId, stripeSubId, planConfig.chatbotLimit, planConfig.messageLimit]
  );
  console.log(`✅ Upserted subscription for ${userId} → ${plan}`);
}

async function getOrCreateStripeCustomer(userId) {
  const res = await pool.query(
    "SELECT stripe_customer_id FROM subscriptions WHERE user_id = $1",
    [userId]
  );
  if (res.rows[0]?.stripe_customer_id) return res.rows[0].stripe_customer_id;

  const customer = await stripe.customers.create({ metadata: { userId } });
  return customer.id;
}

async function getStripeCustomerId(userId) {
  const res = await pool.query(
    "SELECT stripe_customer_id FROM subscriptions WHERE user_id = $1",
    [userId]
  );
  return res.rows[0]?.stripe_customer_id || null;
}
