"use client";

import { useState } from "react";
import Link from "next/link";
import Brand from "@/components/brand";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("household");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault(); setError(""); setMessage(""); setBusy(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: name.trim(), account_type: role } }
      });
      if (error) throw error;
      if (data.session) window.location.href = "/dashboard";
      else setMessage("Account created. Check your email to confirm your address, then sign in.");
    } catch (err) { setError(err.message || "Unable to create account."); }
    finally { setBusy(false); }
  }

  return <main className="grid min-h-screen place-items-center px-5 py-10"><div className="w-full max-w-lg rounded-3xl border border-black/5 bg-white p-6 shadow-soft sm:p-9"><Link href="/"><Brand /></Link><h1 className="mt-8 text-3xl font-extrabold">Create your account</h1><p className="mt-2 text-slate-600">Choose how you plan to use SmartPantry AI. Retailer and organization accounts require admin verification before business actions are enabled.</p><form onSubmit={submit} className="mt-7 space-y-4">
    <div><label htmlFor="name" className="mb-1.5 block text-sm font-semibold">Full name</label><input id="name" required maxLength={80} value={name} onChange={e=>setName(e.target.value)} autoComplete="name" className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-leaf" /></div>
    <div><label htmlFor="email" className="mb-1.5 block text-sm font-semibold">Email address</label><input id="email" type="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-leaf" /></div>
    <div><label htmlFor="role" className="mb-1.5 block text-sm font-semibold">I am joining as</label><select id="role" value={role} onChange={e=>setRole(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-leaf"><option value="household">Household</option><option value="retailer">Grocery shop owner</option><option value="organization">Donation organization</option></select></div>
    <div><label htmlFor="password" className="mb-1.5 block text-sm font-semibold">Password (at least 8 characters)</label><input id="password" type="password" required minLength={8} maxLength={72} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password" className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-leaf" /></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    <button disabled={busy} className="w-full rounded-xl bg-leaf px-4 py-3 font-bold text-white hover:bg-emerald-800 disabled:opacity-60">{busy ? "Creating account…" : "Create account"}</button>
  </form><p className="mt-6 text-center text-sm text-slate-600">Already registered? <Link href="/login" className="font-bold text-leaf hover:underline">Sign in</Link></p></div></main>;
}
