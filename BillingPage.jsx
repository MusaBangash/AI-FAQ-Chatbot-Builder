import { useState, useEffect } from "react";

const PLANS = {
  starter: {
    name: "Starter",
    price: 29,
    chatbotLimit: 1,
    messageLimit: 500,
    features: ["1 chatbot", "500 messages / month", "Basic widget", "Email support"],
  },
  growth: {
    name: "Growth",
    price: 79,
    chatbotLimit: 5,
    messageLimit: 5000,
    features: ["5 chatbots", "5,000 messages / month", "Custom branding", "Chat history", "Priority support"],
    popular: true,
  },
  pro: {
    name: "Pro",
    price: 149,
    chatbotLimit: "Unlimited",
    messageLimit: 50000,
    features: ["Unlimited chatbots", "50,000 messages / month", "API access", "Analytics", "Remove branding", "Dedicated support"],
  },
};

// Mock current subscription
const mockSub = { plan: "growth", messagesUsed: 1560, messageLimit: 5000, chatbotsUsed: 3, chatbotLimit: 5 };

function UsageBar({ used, limit, color }) {
  const pct = Math.min((used / limit) * 100, 100);
  const warning = pct > 80;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-zinc-400">{used.toLocaleString()} used</span>
        <span className={warning ? "text-amber-400" : "text-zinc-500"}>{limit.toLocaleString()} limit</span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: warning ? "#f59e0b" : color }}
        />
      </div>
    </div>
  );
}

function PlanCard({ planId, plan, currentPlan, onUpgrade, loading }) {
  const isCurrent = planId === currentPlan;
  const isDowngrade = ["starter"].includes(planId) && currentPlan !== "starter";
  const color = planId === "starter" ? "#93C5FD" : planId === "growth" ? "#6EE7B7" : "#C4B5FD";

  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-6 transition-all duration-200 ${
        plan.popular
          ? "border-emerald-500/40 bg-emerald-500/5"
          : isCurrent
          ? "border-white/20 bg-white/5"
          : "border-white/8 bg-white/3 hover:border-white/15"
      }`}
    >
      {plan.popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-emerald-500 text-black text-xs font-bold px-3 py-1 rounded-full">Most Popular</span>
        </div>
      )}
      {isCurrent && (
        <div className="absolute -top-3 right-4">
          <span className="bg-white/10 text-white text-xs px-3 py-1 rounded-full border border-white/15">Current Plan</span>
        </div>
      )}

      {/* Color dot + name */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-black" style={{ backgroundColor: color }}>
          {plan.name[0]}
        </div>
        <div>
          <div className="text-base font-semibold text-white">{plan.name}</div>
          <div className="text-xs text-zinc-500">{plan.chatbotLimit} chatbots</div>
        </div>
      </div>

      {/* Price */}
      <div className="mb-5">
        <span className="text-4xl font-bold text-white">${plan.price}</span>
        <span className="text-zinc-500 text-sm ml-1">/month</span>
      </div>

      {/* Features */}
      <ul className="space-y-2.5 mb-6 flex-1">
        {plan.features.map((f, i) => (
          <li key={i} className="flex items-center gap-2.5 text-sm text-zinc-300">
            <span className="text-xs" style={{ color }}>✓</span>
            {f}
          </li>
        ))}
      </ul>

      {/* CTA */}
      <button
        onClick={() => !isCurrent && onUpgrade(planId)}
        disabled={isCurrent || loading === planId}
        className={`w-full py-2.5 rounded-xl text-sm font-semibold transition ${
          isCurrent
            ? "bg-white/5 text-zinc-500 cursor-default"
            : isDowngrade
            ? "border border-white/10 text-zinc-400 hover:bg-white/5"
            : "text-black hover:opacity-90"
        }`}
        style={!isCurrent && !isDowngrade ? { backgroundColor: color } : {}}
      >
        {loading === planId ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            Redirecting...
          </span>
        ) : isCurrent ? "Current Plan" : isDowngrade ? "Downgrade" : "Upgrade →"}
      </button>
    </div>
  );
}

export default function BillingPage() {
  const [loading, setLoading] = useState(null);
  const [sub] = useState(mockSub);
  const [portalLoading, setPortalLoading] = useState(false);

  const handleUpgrade = async (planId) => {
    setLoading(planId);
    try {
      const res = await fetch("/api/stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "checkout", plan: planId }),
      });
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(null);
    }
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "portal" }),
      });
      const { url } = await res.json();
      if (url) window.location.href = url;
    } finally {
      setPortalLoading(false);
    }
  };

  const currentPlanConfig = PLANS[sub.plan];
  const color = sub.plan === "starter" ? "#93C5FD" : sub.plan === "growth" ? "#6EE7B7" : "#C4B5FD";

  return (
    <div className="min-h-screen bg-[#080A0F] text-white px-8 py-10" style={{ fontFamily: "'DM Mono', monospace" }}>
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/3 w-96 h-96 rounded-full opacity-8 blur-3xl" style={{ background: "radial-gradient(circle, #C4B5FD, transparent)" }} />
      </div>

      <div className="max-w-5xl mx-auto relative">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-2xl font-semibold text-white">Billing & Plans</h1>
          <p className="text-sm text-zinc-500 mt-1">Manage your subscription and usage</p>
        </div>

        {/* Current plan summary */}
        <div className="bg-white/3 border border-white/8 rounded-2xl p-6 mb-10">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="text-xs text-zinc-500 uppercase tracking-widest mb-1 font-mono">Current Plan</div>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-white">{currentPlanConfig.name}</span>
                <span className="text-xs px-2 py-0.5 rounded-full border font-mono" style={{ color, borderColor: `${color}44`, background: `${color}11` }}>
                  Active
                </span>
              </div>
              <div className="text-sm text-zinc-500 mt-0.5">${currentPlanConfig.price}/month</div>
            </div>
            <button
              onClick={handlePortal}
              disabled={portalLoading}
              className="text-xs px-4 py-2 rounded-xl border border-white/10 text-zinc-400 hover:bg-white/5 transition"
            >
              {portalLoading ? "Loading..." : "Manage Subscription ↗"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-xs text-zinc-500 mb-2 font-mono uppercase tracking-wider">Messages This Month</div>
              <UsageBar used={sub.messagesUsed} limit={sub.messageLimit} color={color} />
            </div>
            <div>
              <div className="text-xs text-zinc-500 mb-2 font-mono uppercase tracking-wider">Chatbots Used</div>
              <UsageBar used={sub.chatbotsUsed} limit={sub.chatbotLimit} color={color} />
            </div>
          </div>
        </div>

        {/* Plan cards */}
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-widest">Available Plans</h2>
        </div>
        <div className="grid grid-cols-3 gap-5 mb-10">
          {Object.entries(PLANS).map(([id, plan]) => (
            <PlanCard
              key={id}
              planId={id}
              plan={plan}
              currentPlan={sub.plan}
              onUpgrade={handleUpgrade}
              loading={loading}
            />
          ))}
        </div>

        {/* FAQ */}
        <div className="bg-white/3 border border-white/8 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Billing FAQ</h3>
          <div className="space-y-4">
            {[
              { q: "When am I billed?", a: "You're billed monthly on the date you first subscribed. Upgrades are prorated." },
              { q: "What happens if I hit my message limit?", a: "The chatbot will return a friendly limit message. Upgrade anytime to restore access immediately." },
              { q: "Can I cancel anytime?", a: "Yes. Cancel from the Manage Subscription portal. Your plan stays active until the end of the billing period." },
              { q: "Do unused messages roll over?", a: "No. Message counts reset at the start of each billing cycle." },
            ].map((item, i) => (
              <div key={i} className={i < 3 ? "pb-4 border-b border-white/5" : ""}>
                <div className="text-sm text-white mb-1">{item.q}</div>
                <div className="text-xs text-zinc-500 leading-relaxed">{item.a}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
