// components/EmbedSnippet.jsx
// Shows customer their embed code with copy button

import { useState } from "react";

export default function EmbedSnippet({ chatbotId, chatbotName, color = "#6EE7B7" }) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("html");

  const snippets = {
    html: `<!-- ${chatbotName} Widget -->
<script src="https://yourapp.com/api/widget?id=${chatbotId}"></script>`,

    wordpress: `// Add to your theme's functions.php
function add_chatbase_widget() {
  echo '<script src="https://yourapp.com/api/widget?id=${chatbotId}"></script>';
}
add_action('wp_footer', 'add_chatbase_widget');`,

    shopify: `<!-- Add to theme.liquid before </body> -->
<script src="https://yourapp.com/api/widget?id=${chatbotId}"></script>`,
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(snippets[activeTab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-[#0F1117] border border-white/10 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/8">
        <h3 className="text-sm font-semibold text-white">Install Widget</h3>
        <p className="text-xs text-zinc-500 mt-0.5">Paste this snippet before the &lt;/body&gt; tag</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/8">
        {[
          { id: "html", label: "HTML" },
          { id: "wordpress", label: "WordPress" },
          { id: "shopify", label: "Shopify" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 text-xs font-mono transition ${
              activeTab === tab.id
                ? "text-white border-b-2"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
            style={activeTab === tab.id ? { borderColor: color } : {}}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Code block */}
      <div className="relative">
        <pre className="px-6 py-5 text-xs font-mono text-emerald-300 leading-relaxed overflow-x-auto whitespace-pre-wrap">
          {snippets[activeTab]}
        </pre>
        <button
          onClick={handleCopy}
          className="absolute top-3 right-3 text-xs px-3 py-1.5 rounded-lg border transition"
          style={{
            borderColor: copied ? color : "rgba(255,255,255,0.1)",
            color: copied ? color : "#6b7280",
            background: copied ? `${color}15` : "rgba(255,255,255,0.04)",
          }}
        >
          {copied ? "✓ Copied!" : "Copy"}
        </button>
      </div>

      {/* Test link */}
      <div className="px-6 py-4 border-t border-white/8 flex items-center justify-between">
        <span className="text-xs text-zinc-500">Widget ID: <span className="font-mono text-zinc-400">{chatbotId}</span></span>
        <a
          href={`/preview/${chatbotId}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs px-4 py-1.5 rounded-xl text-black font-semibold transition hover:opacity-90"
          style={{ backgroundColor: color }}
        >
          Preview Widget →
        </a>
      </div>
    </div>
  );
}
