// public/widget.js
// Embeddable chat widget — customers paste one <script> tag on their site
// Usage:
//   <script>window.chatbotId = "YOUR_BOT_ID";</script>
//   <script src="https://yourapp.com/widget.js"></script>

(function () {
  "use strict";

  const CHAT_API = "https://yourapp.com/api/chat"; // ← change to your domain
  const chatbotId = window.chatbotId;

  if (!chatbotId) {
    console.warn("[ChatBase] Missing window.chatbotId");
    return;
  }

  // ─── Config (can be overridden by window.chatbaseConfig) ──────────
  const config = Object.assign(
    {
      color: "#6EE7B7",
      position: "bottom-right", // bottom-right | bottom-left
      welcomeMessage: "Hi! How can I help you today? 👋",
      placeholder: "Ask me anything...",
      title: "Support",
    },
    window.chatbaseConfig || {}
  );

  // ─── State ────────────────────────────────────────────────────────
  let isOpen = false;
  let sessionId = null;
  let history = [];
  let isLoading = false;

  // ─── Styles ───────────────────────────────────────────────────────
  const style = document.createElement("style");
  style.textContent = `
    #cb-root * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; }

    #cb-btn {
      position: fixed;
      ${config.position === "bottom-left" ? "left: 24px" : "right: 24px"};
      bottom: 24px;
      width: 56px; height: 56px;
      border-radius: 50%;
      background: ${config.color};
      border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 24px rgba(0,0,0,0.18);
      z-index: 999999;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    #cb-btn:hover { transform: scale(1.08); box-shadow: 0 8px 32px rgba(0,0,0,0.22); }
    #cb-btn svg { width: 24px; height: 24px; }

    #cb-window {
      position: fixed;
      ${config.position === "bottom-left" ? "left: 24px" : "right: 24px"};
      bottom: 92px;
      width: 370px; height: 540px;
      background: #0f1117;
      border-radius: 20px;
      border: 1px solid rgba(255,255,255,0.1);
      box-shadow: 0 16px 64px rgba(0,0,0,0.5);
      display: flex; flex-direction: column;
      overflow: hidden;
      z-index: 999998;
      transform: scale(0.92) translateY(16px);
      opacity: 0;
      pointer-events: none;
      transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s ease;
    }
    #cb-window.open {
      transform: scale(1) translateY(0);
      opacity: 1;
      pointer-events: all;
    }

    #cb-header {
      display: flex; align-items: center; gap: 10px;
      padding: 14px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.07);
      background: rgba(255,255,255,0.03);
    }
    #cb-avatar {
      width: 34px; height: 34px; border-radius: 50%;
      background: ${config.color};
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 14px; color: #000;
    }
    #cb-header-info { flex: 1; }
    #cb-header-title { font-size: 14px; font-weight: 600; color: #fff; }
    #cb-header-status { display: flex; align-items: center; gap: 5px; margin-top: 2px; }
    #cb-status-dot { width: 7px; height: 7px; border-radius: 50%; background: #34d399; }
    #cb-header-status span { font-size: 11px; color: #6b7280; }
    #cb-close {
      background: none; border: none; cursor: pointer;
      color: #6b7280; font-size: 18px; line-height: 1;
      padding: 4px; border-radius: 6px;
      transition: color 0.15s, background 0.15s;
    }
    #cb-close:hover { color: #fff; background: rgba(255,255,255,0.08); }

    #cb-messages {
      flex: 1; overflow-y: auto; padding: 16px;
      display: flex; flex-direction: column; gap: 10px;
      scroll-behavior: smooth;
    }
    #cb-messages::-webkit-scrollbar { width: 4px; }
    #cb-messages::-webkit-scrollbar-track { background: transparent; }
    #cb-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

    .cb-msg { display: flex; max-width: 82%; }
    .cb-msg.user { align-self: flex-end; }
    .cb-msg.assistant { align-self: flex-start; }
    .cb-bubble {
      padding: 10px 14px; border-radius: 18px;
      font-size: 13.5px; line-height: 1.5; word-break: break-word;
    }
    .cb-msg.user .cb-bubble {
      background: ${config.color};
      color: #000; font-weight: 500;
      border-bottom-right-radius: 4px;
    }
    .cb-msg.assistant .cb-bubble {
      background: rgba(255,255,255,0.07);
      color: #e5e7eb;
      border-bottom-left-radius: 4px;
    }

    .cb-typing { display: flex; gap: 4px; align-items: center; padding: 4px 2px; }
    .cb-typing span {
      width: 7px; height: 7px; border-radius: 50%;
      background: #6b7280; display: block;
      animation: cb-bounce 1.2s infinite;
    }
    .cb-typing span:nth-child(2) { animation-delay: 0.2s; }
    .cb-typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes cb-bounce {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-5px); }
    }

    #cb-footer { padding: 12px 14px; border-top: 1px solid rgba(255,255,255,0.07); }
    #cb-input-row {
      display: flex; align-items: center; gap: 8px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 14px; padding: 8px 8px 8px 14px;
      transition: border-color 0.2s;
    }
    #cb-input-row:focus-within { border-color: ${config.color}66; }
    #cb-input {
      flex: 1; background: none; border: none; outline: none;
      color: #fff; font-size: 13.5px;
    }
    #cb-input::placeholder { color: #4b5563; }
    #cb-send {
      width: 32px; height: 32px; border-radius: 10px;
      background: ${config.color};
      border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      transition: opacity 0.15s, transform 0.15s;
    }
    #cb-send:disabled { opacity: 0.35; cursor: not-allowed; }
    #cb-send:not(:disabled):hover { transform: scale(1.08); }
    #cb-send svg { width: 14px; height: 14px; }
    #cb-branding { text-align: center; font-size: 11px; color: #374151; margin-top: 8px; }
    #cb-branding a { color: #4b5563; text-decoration: none; }
    #cb-branding a:hover { color: #6b7280; }

    @media (max-width: 420px) {
      #cb-window { width: calc(100vw - 24px); left: 12px; right: 12px; bottom: 80px; }
    }
  `;
  document.head.appendChild(style);

  // ─── HTML ─────────────────────────────────────────────────────────
  const root = document.createElement("div");
  root.id = "cb-root";
  root.innerHTML = `
    <button id="cb-btn" aria-label="Open chat">
      <svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    </button>

    <div id="cb-window" role="dialog" aria-label="Chat window">
      <div id="cb-header">
        <div id="cb-avatar">${config.title[0]}</div>
        <div id="cb-header-info">
          <div id="cb-header-title">${config.title}</div>
          <div id="cb-header-status">
            <div id="cb-status-dot"></div>
            <span>Online</span>
          </div>
        </div>
        <button id="cb-close" aria-label="Close chat">✕</button>
      </div>

      <div id="cb-messages"></div>

      <div id="cb-footer">
        <div id="cb-input-row">
          <input id="cb-input" type="text" placeholder="${config.placeholder}" autocomplete="off" maxlength="500" />
          <button id="cb-send" disabled aria-label="Send">
            <svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
            </svg>
          </button>
        </div>
        <div id="cb-branding">Powered by <a href="https://yourapp.com" target="_blank">ChatBase</a></div>
      </div>
    </div>
  `;
  document.body.appendChild(root);

  // ─── DOM refs ─────────────────────────────────────────────────────
  const btnEl = root.querySelector("#cb-btn");
  const windowEl = root.querySelector("#cb-window");
  const messagesEl = root.querySelector("#cb-messages");
  const inputEl = root.querySelector("#cb-input");
  const sendEl = root.querySelector("#cb-send");
  const closeEl = root.querySelector("#cb-close");

  // ─── Helpers ──────────────────────────────────────────────────────
  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function addMessage(role, content = "") {
    const wrap = document.createElement("div");
    wrap.className = `cb-msg ${role}`;
    const bubble = document.createElement("div");
    bubble.className = "cb-bubble";
    if (content) bubble.textContent = content;
    wrap.appendChild(bubble);
    messagesEl.appendChild(wrap);
    scrollToBottom();
    return bubble;
  }

  function showTyping() {
    const wrap = document.createElement("div");
    wrap.className = "cb-msg assistant";
    wrap.id = "cb-typing-indicator";
    wrap.innerHTML = `<div class="cb-bubble"><div class="cb-typing"><span></span><span></span><span></span></div></div>`;
    messagesEl.appendChild(wrap);
    scrollToBottom();
  }

  function removeTyping() {
    const el = root.querySelector("#cb-typing-indicator");
    if (el) el.remove();
  }

  function toggleOpen() {
    isOpen = !isOpen;
    windowEl.classList.toggle("open", isOpen);
    btnEl.innerHTML = isOpen
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
    if (isOpen) {
      inputEl.focus();
      if (messagesEl.children.length === 0) {
        addMessage("assistant", config.welcomeMessage);
      }
    }
  }

  // ─── Send message ─────────────────────────────────────────────────
  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text || isLoading) return;

    inputEl.value = "";
    sendEl.disabled = true;
    isLoading = true;

    addMessage("user", text);
    showTyping();

    try {
      const res = await fetch(CHAT_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatbotId,
          message: text,
          sessionId,
          history: history.slice(-10),
        }),
      });

      removeTyping();
      const bubble = addMessage("assistant");

      // Read SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const lines = decoder.decode(value).split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.token) {
              fullText += data.token;
              bubble.textContent = fullText;
              scrollToBottom();
            }
            if (data.sessionId) sessionId = data.sessionId;
            if (data.error) bubble.textContent = "Sorry, something went wrong. Please try again.";
          } catch {}
        }
      }

      // Update history
      history.push({ role: "user", content: text });
      history.push({ role: "assistant", content: fullText });

    } catch {
      removeTyping();
      addMessage("assistant", "Connection error. Please try again.");
    } finally {
      isLoading = false;
      sendEl.disabled = !inputEl.value.trim();
      inputEl.focus();
    }
  }

  // ─── Event listeners ──────────────────────────────────────────────
  btnEl.addEventListener("click", toggleOpen);
  closeEl.addEventListener("click", toggleOpen);
  sendEl.addEventListener("click", sendMessage);
  inputEl.addEventListener("keydown", (e) => { if (e.key === "Enter") sendMessage(); });
  inputEl.addEventListener("input", () => { sendEl.disabled = !inputEl.value.trim() || isLoading; });

  // Close on outside click
  document.addEventListener("click", (e) => {
    if (isOpen && !root.contains(e.target)) toggleOpen();
  });

})();
