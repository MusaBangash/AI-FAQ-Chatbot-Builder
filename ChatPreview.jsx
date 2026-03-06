// components/ChatPreview.jsx
// Live chat preview inside the dashboard for testing your chatbot

import { useState, useRef, useEffect } from "react";

export default function ChatPreview({ chatbotId, chatbotName, color = "#6EE7B7" }) {
  const [messages, setMessages] = useState([
    { role: "assistant", content: `Hi! I'm ${chatbotName}. Ask me anything about our website! 👋` },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    // Add empty assistant message to stream into
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatbotId,
          message: userMessage,
          sessionId,
          history: messages.slice(-10),
        }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const lines = decoder.decode(value).split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.token) {
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1].content += data.token;
                return updated;
              });
            }
            if (data.sessionId && !sessionId) {
              setSessionId(data.sessionId);
            }
            if (data.error) {
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1].content = "Sorry, something went wrong. Please try again.";
                return updated;
              });
            }
          } catch {}
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1].content = "Connection error. Please try again.";
        return updated;
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex flex-col rounded-2xl overflow-hidden border border-white/10 bg-[#0F1117]"
      style={{ height: "520px", width: "360px" }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ background: `linear-gradient(135deg, ${color}22, ${color}11)`, borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-black font-bold text-sm"
          style={{ backgroundColor: color }}
        >
          {chatbotName?.[0] || "A"}
        </div>
        <div>
          <div className="text-sm font-semibold text-white">{chatbotName}</div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-xs text-zinc-400">Online</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                msg.role === "user"
                  ? "text-black font-medium rounded-br-sm"
                  : "bg-white/8 text-zinc-200 rounded-bl-sm"
              }`}
              style={msg.role === "user" ? { backgroundColor: color } : {}}
            >
              {msg.content || (
                <span className="flex gap-1 items-center py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                </span>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-white/5">
        <div className="flex gap-2 items-center bg-white/5 rounded-xl px-3 py-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Ask a question..."
            disabled={loading}
            className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-600 focus:outline-none"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-black text-xs font-bold disabled:opacity-30 transition"
            style={{ backgroundColor: color }}
          >
            ↑
          </button>
        </div>
        <p className="text-center text-xs text-zinc-700 mt-2">Powered by ChatBase AI</p>
      </div>
    </div>
  );
}
