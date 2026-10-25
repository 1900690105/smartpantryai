"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }
  return <button onClick={logout} disabled={busy} className="rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold hover:bg-black/5 disabled:opacity-50">{busy ? "Signing out…" : "Sign out"}</button>;
}
