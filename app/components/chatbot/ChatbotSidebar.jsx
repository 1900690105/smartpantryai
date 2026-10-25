"use client";

import { useMemo } from "react";

const ROLE_PROMPTS = {
  user: [
    { icon: "🥬", label: "Pantry stock", question: "What is currently in my pantry?" },
    { icon: "⏰", label: "Use-first items", question: "Which items should I use first?" },
    { icon: "🍲", label: "Meal ideas", question: "Suggest a simple meal using common pantry ingredients." },
    { icon: "🛒", label: "Shopping list", question: "Help me make a grocery shopping list without buying duplicates." },
    { icon: "♻️", label: "Reduce waste", question: "Give me practical tips to reduce food waste this week." },
  ],
  shop_owner: [
    { icon: "📦", label: "Stock overview", question: "How should I review my shop stock and identify low-stock products?" },
    { icon: "📉", label: "Low-stock planning", question: "Help me prepare a low-stock review checklist." },
    { icon: "📅", label: "Expiry review", question: "How can I organize a daily review of products nearing their recorded expiry dates?" },
    { icon: "📊", label: "Sales & demand", question: "What information should I track to understand product demand?" },
    { icon: "♻️", label: "Surplus planning", question: "Suggest responsible ways to manage safe, unsold surplus stock." },
  ],
  organization: [
    { icon: "🤝", label: "Donation planning", question: "Create a checklist for receiving and distributing food donations responsibly." },
    { icon: "📦", label: "Donation inventory", question: "What details should we record when accepting donated food?" },
    { icon: "🗓️", label: "Distribution plan", question: "Help me plan a fair food distribution schedule for a community." },
    { icon: "🧾", label: "Impact report", question: "Create a template to report food received, distributed, and remaining." },
    { icon: "🛡️", label: "Food safety", question: "Give me a checklist for checking food packaging and recorded dates before distribution." },
  ],
};

const ROLE_LABELS = {
  user: "Household assistant",
  shop_owner: "Shop owner assistant",
  organization: "Organization assistant",
};

function normalizeRole(value) {
  const role = String(value || "").toLowerCase().replace(/[\s-]+/g, "_");
  if (["shop_owner", "shopowner", "owner", "seller", "store_owner"].includes(role)) return "shop_owner";
  if (["organization", "org", "ngo", "charity", "nonprofit"].includes(role)) return "organization";
  return "user";
}

/**
 * role should come from the authenticated user's profile/session.
 * If omitted, we attempt a common localStorage profile shape and safely default to "user".
 * Pass the role explicitly from the parent whenever possible.
 */
export default function ChatbotSidebar({ role, onSelectQuestion }) {
  const activeRole = useMemo(() => {
    if (role) return normalizeRole(role);
    if (typeof window === "undefined") return "user";
    try {
      const profile = JSON.parse(
        localStorage.getItem("user") ||
        localStorage.getItem("profile") ||
        localStorage.getItem("currentUser") ||
        "{}"
      );
      return normalizeRole(profile.role || profile.userRole || profile.accountType);
    } catch {
      return "user";
    }
  }, [role]);

  const prompts = ROLE_PROMPTS[activeRole];

  return (
    <aside className="sp-role-sidebar">
      <div className="sp-role-heading">
        <span className="sp-role-eyebrow">QUICK PROMPTS</span>
        <h2>What can I help with?</h2>
        <p>Suggested for your account type</p>
      </div>

      <div className="sp-role-badge">
        <span className="sp-role-badge-dot" />
        {ROLE_LABELS[activeRole]}
      </div>

      <div className="sp-role-prompt-list">
        {prompts.map((item) => (
          <button
            className="sp-role-prompt"
            type="button"
            key={item.label}
            onClick={() => onSelectQuestion?.(item.question)}
          >
            <span className="sp-role-prompt-icon">{item.icon}</span>
            <span className="sp-role-prompt-text">
              <strong>{item.label}</strong>
              <small>{item.question}</small>
            </span>
            <span className="sp-role-prompt-arrow">↗</span>
          </button>
        ))}
      </div>

      <div className="sp-role-static-note">
        <span>✦</span>
        <div>
          <strong>Try a question</strong>
          <p>Tap any prompt to send it to the AI assistant. These are starter questions, not live inventory results.</p>
        </div>
      </div>

      <style jsx>{`
        .sp-role-sidebar { width: 100%; color: #20352a; }
        .sp-role-heading { margin-bottom: 16px; }
        .sp-role-eyebrow { color: #438d5a; font-size: 9px; font-weight: 800; letter-spacing: 1.35px; }
        .sp-role-heading h2 { margin: 9px 0 5px; font-size: 17px; letter-spacing: -.4px; }
        .sp-role-heading p { margin: 0; color: #819087; font-size: 11px; }
        .sp-role-badge { display: inline-flex; align-items: center; gap: 7px; margin-bottom: 17px; padding: 7px 10px; border: 1px solid #dceee0; border-radius: 20px; background: #eff8f0; color: #34734a; font-size: 10px; font-weight: 700; }
        .sp-role-badge-dot { width: 6px; height: 6px; border-radius: 50%; background: #2b9a5b; }
        .sp-role-prompt-list { display: grid; gap: 8px; }
        .sp-role-prompt { display: flex; align-items: center; gap: 10px; width: 100%; padding: 11px 9px; border: 1px solid #e8eee8; border-radius: 12px; background: #fff; color: inherit; text-align: left; cursor: pointer; transition: border-color .15s, background .15s, transform .15s; }
        .sp-role-prompt:hover { transform: translateY(-1px); border-color: #b9dfc4; background: #f7fbf7; }
        .sp-role-prompt-icon { display: grid; place-items: center; width: 33px; height: 33px; flex: 0 0 auto; border-radius: 10px; background: #eef7ef; font-size: 16px; }
        .sp-role-prompt-text { display: grid; gap: 4px; min-width: 0; flex: 1; }
        .sp-role-prompt-text strong { font-size: 11px; }
        .sp-role-prompt-text small { color: #7c8980; font-size: 10px; line-height: 1.45; }
        .sp-role-prompt-arrow { color: #46915c; font-size: 13px; }
        .sp-role-static-note { display: flex; gap: 10px; margin-top: 17px; padding: 12px; border-radius: 12px; background: #f2f7ef; }
        .sp-role-static-note > span { color: #428853; font-size: 17px; }
        .sp-role-static-note strong { font-size: 11px; }
        .sp-role-static-note p { margin: 5px 0 0; color: #77857b; font-size: 10px; line-height: 1.55; }
      `}</style>
    </aside>
  );
}

export { ROLE_PROMPTS, ROLE_LABELS, normalizeRole };
