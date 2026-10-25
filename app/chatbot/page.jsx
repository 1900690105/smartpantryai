"use client";

import { useEffect, useRef, useState } from "react";
import ChatbotSidebar from "../components/chatbot/ChatbotSidebar";

const starterPrompts = [
  "What should I use first from my pantry?",
  "Suggest a meal with what I have",
  "Help me avoid duplicate grocery purchases",
  "How can I reduce food waste this week?",
];

export default function ChatbotPage() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi! 👋 I'm your SmartPantry assistant. I can help you plan meals, understand your pantry, make smarter shopping decisions, and reduce food waste.\n\nWhat would you like help with today?",
      time: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function sendMessage(text = input) {
    const content = text.trim();
    if (!content || sending) return;

    const userMessage = { role: "user", content, time: new Date() };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setError("");
    setSending(true);

    try {
      const response = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          history: nextMessages
            .filter((m) => m.role === "user" || m.role === "assistant")
            .slice(-12)
            .map(({ role, content }) => ({ role, content })),
        }),
      });

      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Unable to get a response.");

      setMessages((current) => [
        ...current,
        { role: "assistant", content: data.reply, time: new Date() },
      ]);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function onSubmit(event) {
    event.preventDefault();
    sendMessage();
  }

  function formatTime(date) {
    return new Intl.DateTimeFormat("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date instanceof Date ? date : new Date(date));
  }

  return (
    <main className="sp-chat-page">
      <section className="sp-chat-shell" aria-label="SmartPantry AI chat">
        <aside className="sp-chat-sidebar">
          <div className="sp-brand">
            <div className="sp-brand-mark">🥬</div>
            <div>
              <strong>SmartPantry AI</strong>
              <span>Your food companion</span>
            </div>
          </div>

          <a className="sp-back-link" href="/dashboard">
            <span aria-hidden="true">←</span> Back to dashboard
          </a>

          <div className="sp-sidebar-section">
            <p className="sp-sidebar-label">YOUR ASSISTANT</p>
            <div className="sp-active-chat">
              <span className="sp-chat-icon">✦</span>
              <span>
                <strong>Pantry Assistant</strong>
                <small>Meals, shopping & less waste</small>
              </span>
              <span className="sp-online-dot" />
            </div>
          </div>

          <div className="sp-sidebar-section">
            <p className="sp-sidebar-label">TRY ASKING</p>
            {starterPrompts.map((prompt) => (
              <button
                className="sp-suggestion"
                key={prompt}
                type="button"
                onClick={() => sendMessage(prompt)}
                disabled={sending}
              >
                <span>↗</span>
                {prompt}
              </button>
            ))}
          </div>
          <ChatbotSidebar
            onSelectQuestion={(question) => sendMessage(question)}
          />
          <div className="sp-sidebar-note">
            <span>✧</span>
            <div>
              <strong>Small choices matter</strong>
              <p>Use what you have. Buy what you need. Waste less.</p>
            </div>
          </div>

          <div className="sp-sidebar-footer">SMARTER FOOD. LESS WASTE.</div>
        </aside>

        <section className="sp-chat-main">
          <header className="sp-chat-header">
            <div className="sp-assistant-avatar">🥬</div>
            <div className="sp-header-copy">
              <strong>Pantry Assistant</strong>
              <span>
                <i /> AI-powered food companion
              </span>
            </div>
            <div className="sp-header-badge">
              <span>✦</span> SmartPantry AI
            </div>
          </header>

          <div className="sp-chat-notice">
            <span>🔒</span>
            <p>
              Ask about meal ideas, pantry planning, grocery decisions, and
              reducing food waste.
            </p>
          </div>

          <div className="sp-messages" role="log" aria-live="polite">
            <div className="sp-day-divider">
              <span>TODAY</span>
            </div>
            {messages.map((message, index) => (
              <div
                className={`sp-message-row ${message.role === "user" ? "is-user" : "is-assistant"}`}
                key={`${index}-${message.role}`}
              >
                {message.role === "assistant" && (
                  <div className="sp-mini-avatar">🥬</div>
                )}
                <div className="sp-message-stack">
                  <div className="sp-bubble">
                    {message.content.split("\n").map((line, lineIndex) => (
                      <span key={lineIndex}>
                        {line || "\u00a0"}
                        {lineIndex < message.content.split("\n").length - 1 && (
                          <br />
                        )}
                      </span>
                    ))}
                    <span className="sp-message-time">
                      {formatTime(message.time)}
                    </span>
                  </div>
                  {message.role === "user" && (
                    <span className="sp-delivered">✓✓</span>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="sp-message-row is-assistant">
                <div className="sp-mini-avatar">🥬</div>
                <div
                  className="sp-bubble sp-typing"
                  aria-label="Assistant is typing"
                >
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            )}
            {error && (
              <div className="sp-error" role="alert">
                {error}{" "}
                <button type="button" onClick={() => setError("")}>
                  Dismiss
                </button>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form className="sp-composer" onSubmit={onSubmit}>
            <div className="sp-composer-inner">
              <span className="sp-composer-spark">✦</span>
              <input
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Message your pantry assistant..."
                aria-label="Message your pantry assistant"
                disabled={sending}
                maxLength={2000}
              />
              <span className="sp-enter-hint">Enter ↵</span>
              <button
                className="sp-send-button"
                type="submit"
                disabled={!input.trim() || sending}
                aria-label="Send message"
              >
                ➤
              </button>
            </div>
            <p className="sp-disclaimer">
              AI can make mistakes. Check product labels and food-safety
              guidance.
            </p>
          </form>
        </section>
      </section>

      <style jsx global>{`
        :root {
          color-scheme: light;
        }
        * {
          box-sizing: border-box;
        }
        body {
          margin: 0;
        }
        .sp-chat-page {
          min-height: 100vh;
          padding: 22px;
          background: #eef2ef;
          color: #17251f;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }
        .sp-chat-shell {
          max-width: 1500px;
          min-height: calc(100vh - 44px);
          margin: 0 auto;
          display: grid;
          grid-template-columns: 300px minmax(0, 1fr);
          overflow: hidden;
          background: #fff;
          border: 1px solid #dce6df;
          border-radius: 22px;
          box-shadow: 0 24px 80px rgba(22, 49, 35, 0.1);
        }
        .sp-chat-sidebar {
          position: relative;
          display: flex;
          flex-direction: column;
          padding: 26px 18px 18px;
          background: #f7faf7;
          border-right: 1px solid #e4ebe5;
        }
        .sp-brand {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 0 7px 26px;
        }
        .sp-brand-mark {
          display: grid;
          place-items: center;
          width: 43px;
          height: 43px;
          border-radius: 14px;
          background: #dff5e7;
          font-size: 23px;
        }
        .sp-brand strong,
        .sp-brand span {
          display: block;
        }
        .sp-brand strong {
          font-size: 15px;
          letter-spacing: -0.3px;
        }
        .sp-brand span {
          margin-top: 3px;
          font-size: 11px;
          color: #718078;
        }
        .sp-back-link {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 11px 12px;
          margin-bottom: 30px;
          color: #5c6d63;
          font-size: 12px;
          text-decoration: none;
          border-radius: 10px;
        }
        .sp-back-link:hover {
          background: #edf3ee;
          color: #1d7545;
        }
        .sp-sidebar-label {
          margin: 0 8px 12px;
          color: #8b9990;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1.3px;
        }
        .sp-sidebar-section {
          margin-bottom: 28px;
        }
        .sp-active-chat {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 10px;
          background: #e5f5ea;
          border: 1px solid #d2eddb;
          border-radius: 13px;
        }
        .sp-chat-icon {
          display: grid;
          place-items: center;
          width: 34px;
          height: 34px;
          flex: 0 0 auto;
          border-radius: 10px;
          background: #25834c;
          color: white;
        }
        .sp-active-chat strong,
        .sp-active-chat small {
          display: block;
        }
        .sp-active-chat strong {
          font-size: 11px;
        }
        .sp-active-chat small {
          margin-top: 4px;
          font-size: 10px;
          color: #607568;
        }
        .sp-online-dot {
          width: 7px;
          height: 7px;
          margin-left: auto;
          border-radius: 50%;
          background: #26a269;
        }
        .sp-suggestion {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          width: 100%;
          padding: 11px 9px;
          border: 0;
          border-radius: 9px;
          background: transparent;
          color: #53645a;
          text-align: left;
          font: inherit;
          font-size: 11px;
          line-height: 1.5;
          cursor: pointer;
        }
        .sp-suggestion span {
          color: #20804a;
        }
        .sp-suggestion:hover:not(:disabled) {
          background: #edf4ee;
          color: #1d7545;
        }
        .sp-suggestion:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .sp-sidebar-note {
          display: flex;
          gap: 11px;
          margin-top: auto;
          padding: 14px 12px;
          background: #f0f6ee;
          border: 1px solid #e3eddf;
          border-radius: 13px;
        }
        .sp-sidebar-note > span {
          color: #438d54;
          font-size: 18px;
        }
        .sp-sidebar-note strong {
          font-size: 11px;
        }
        .sp-sidebar-note p {
          margin: 5px 0 0;
          color: #718078;
          font-size: 10px;
          line-height: 1.55;
        }
        .sp-sidebar-footer {
          padding: 20px 8px 0;
          color: #a1aca4;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 1.4px;
        }
        .sp-chat-main {
          min-width: 0;
          display: flex;
          flex-direction: column;
          background: #fff;
        }
        .sp-chat-header {
          height: 82px;
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 30px;
          border-bottom: 1px solid #edf1ed;
        }
        .sp-assistant-avatar {
          display: grid;
          place-items: center;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: #e5f5e9;
          font-size: 22px;
        }
        .sp-header-copy {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .sp-header-copy strong {
          font-size: 14px;
        }
        .sp-header-copy span {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #7c8b81;
          font-size: 11px;
        }
        .sp-header-copy i {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #24a15a;
        }
        .sp-header-badge {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-left: auto;
          padding: 8px 11px;
          color: #31774a;
          background: #f0f8f1;
          border: 1px solid #e1f0e3;
          border-radius: 30px;
          font-size: 10px;
          font-weight: 700;
        }
        .sp-chat-notice {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 9px;
          margin: 18px auto 4px;
          max-width: 88%;
          padding: 9px 15px;
          background: #f4f8f3;
          border: 1px solid #eaf0e7;
          border-radius: 9px;
          color: #7c897e;
        }
        .sp-chat-notice p {
          margin: 0;
          font-size: 10px;
          line-height: 1.45;
          text-align: center;
        }
        .sp-messages {
          flex: 1;
          min-height: 320px;
          padding: 18px clamp(18px, 5vw, 78px) 24px;
          overflow-y: auto;
          background-color: #fcfdfb;
          background-image: radial-gradient(#e8eee7 0.7px, transparent 0.7px);
          background-size: 19px 19px;
        }
        .sp-day-divider {
          display: flex;
          justify-content: center;
          margin: 2px 0 25px;
        }
        .sp-day-divider span {
          padding: 6px 11px;
          border: 1px solid #e9eee8;
          border-radius: 7px;
          background: #fff;
          color: #8b988d;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1px;
        }
        .sp-message-row {
          display: flex;
          align-items: flex-end;
          gap: 9px;
          margin: 0 0 19px;
        }
        .sp-message-row.is-user {
          justify-content: flex-end;
        }
        .sp-mini-avatar {
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #e5f5e9;
          font-size: 14px;
        }
        .sp-message-stack {
          max-width: min(78%, 590px);
          display: flex;
          flex-direction: column;
          align-items: flex-end;
        }
        .is-assistant .sp-message-stack {
          align-items: flex-start;
        }
        .sp-bubble {
          position: relative;
          padding: 13px 15px 24px;
          border: 1px solid #e7ece7;
          border-radius: 15px 15px 15px 4px;
          background: #fff;
          color: #34463a;
          box-shadow: 0 2px 5px rgba(20, 45, 29, 0.025);
          font-size: 12px;
          line-height: 1.7;
          overflow-wrap: anywhere;
        }
        .is-user .sp-bubble {
          border-color: #d7f0df;
          border-radius: 15px 15px 4px 15px;
          background: #dcf5e3;
          color: #213d2b;
        }
        .sp-message-time {
          position: absolute;
          right: 10px;
          bottom: 5px;
          color: #8c9a8e;
          font-size: 8px;
        }
        .sp-delivered {
          margin: 3px 5px 0 0;
          color: #329c65;
          font-size: 10px;
        }
        .sp-typing {
          display: flex;
          align-items: center;
          gap: 4px;
          min-width: 60px;
          padding: 15px;
        }
        .sp-typing i {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #85a18c;
          animation: sp-pulse 1s infinite ease-in-out;
        }
        .sp-typing i:nth-child(2) {
          animation-delay: 0.15s;
        }
        .sp-typing i:nth-child(3) {
          animation-delay: 0.3s;
        }
        @keyframes sp-pulse {
          0%,
          60%,
          100% {
            opacity: 0.35;
            transform: translateY(0);
          }
          30% {
            opacity: 1;
            transform: translateY(-3px);
          }
        }
        .sp-error {
          max-width: 90%;
          margin: 0 auto 12px;
          padding: 10px 12px;
          border: 1px solid #f4cccc;
          border-radius: 9px;
          background: #fff2f2;
          color: #9b3333;
          font-size: 11px;
        }
        .sp-error button {
          margin-left: 10px;
          border: 0;
          background: transparent;
          color: inherit;
          text-decoration: underline;
          cursor: pointer;
        }
        .sp-composer {
          padding: 16px clamp(18px, 5vw, 78px) 13px;
          border-top: 1px solid #edf1ed;
          background: #fff;
        }
        .sp-composer-inner {
          display: flex;
          align-items: center;
          gap: 12px;
          min-height: 57px;
          padding: 7px 8px 7px 15px;
          border: 1px solid #dfe8df;
          border-radius: 15px;
          background: #fbfdfb;
          box-shadow: 0 4px 15px rgba(20, 45, 29, 0.035);
        }
        .sp-composer-spark {
          color: #319457;
          font-size: 17px;
        }
        .sp-composer input {
          min-width: 0;
          flex: 1;
          padding: 10px 0;
          border: 0;
          outline: 0;
          background: transparent;
          color: #20352a;
          font: inherit;
          font-size: 12px;
        }
        .sp-composer input::placeholder {
          color: #9aa69d;
        }
        .sp-enter-hint {
          color: #a1aba3;
          font-size: 9px;
          white-space: nowrap;
        }
        .sp-send-button {
          display: grid;
          place-items: center;
          width: 39px;
          height: 39px;
          flex: 0 0 auto;
          border: 0;
          border-radius: 11px;
          background: #23864c;
          color: white;
          font-size: 17px;
          cursor: pointer;
          transition:
            transform 0.15s,
            background 0.15s;
        }
        .sp-send-button:hover:not(:disabled) {
          transform: translateY(-1px);
          background: #176e3b;
        }
        .sp-send-button:disabled {
          background: #b8cbbd;
          cursor: not-allowed;
        }
        .sp-disclaimer {
          margin: 9px 0 0;
          color: #a0aaa2;
          text-align: center;
          font-size: 9px;
        }
        @media (max-width: 820px) {
          .sp-chat-page {
            padding: 0;
          }
          .sp-chat-shell {
            min-height: 100vh;
            grid-template-columns: 1fr;
            border: 0;
            border-radius: 0;
          }
          .sp-chat-sidebar {
            display: none;
          }
          .sp-chat-header {
            height: 72px;
            padding: 0 16px;
          }
          .sp-header-badge {
            font-size: 9px;
            padding: 7px 8px;
          }
          .sp-messages {
            padding: 18px 14px 24px;
          }
          .sp-message-stack {
            max-width: 86%;
          }
          .sp-chat-notice {
            max-width: calc(100% - 28px);
          }
          .sp-composer {
            padding: 12px 12px 10px;
          }
          .sp-enter-hint {
            display: none;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .sp-typing i {
            animation: none;
          }
          .sp-send-button {
            transition: none;
          }
        }
      `}</style>
    </main>
  );
}
