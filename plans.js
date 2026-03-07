// lib/plans.js
// Stripe plan definitions — single source of truth

const PLANS = {
  starter: {
    name: "Starter",
    price: 29,
    priceId: process.env.STRIPE_PRICE_STARTER, // e.g. price_1ABC...
    chatbotLimit: 1,
    messageLimit: 500,
    features: [
      "1 chatbot",
      "500 messages / month",
      "Basic widget",
      "Email support",
    ],
  },
  growth: {
    name: "Growth",
    price: 79,
    priceId: process.env.STRIPE_PRICE_GROWTH,
    chatbotLimit: 5,
    messageLimit: 5000,
    features: [
      "5 chatbots",
      "5,000 messages / month",
      "Custom colors & branding",
      "Chat history",
      "Priority support",
    ],
  },
  pro: {
    name: "Pro",
    price: 149,
    priceId: process.env.STRIPE_PRICE_PRO,
    chatbotLimit: 999, // unlimited
    messageLimit: 50000,
    features: [
      "Unlimited chatbots",
      "50,000 messages / month",
      "API access",
      "Analytics dashboard",
      "Remove ChatBase branding",
      "Dedicated support",
    ],
  },
};

module.exports = { PLANS };
