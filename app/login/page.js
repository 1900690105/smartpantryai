"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Brand from "@/components/brand";
import { createClient } from "@/lib/supabase/client";
import { Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      router.replace(
        params.get("next")?.startsWith("/dashboard")
          ? params.get("next")
          : "/dashboard",
      );
      router.refresh();
    } catch (err) {
      setError(err.message || "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="mt-7 space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-semibold" htmlFor="email">
          Email address
        </label>
        <input
          suppressHydrationWarning
          id="email"
          type="email"
          autoComplete="email"
          required
          placeholder="eg.nikhil12@gmail.com"
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-leaf"
        />
      </div>
      <div>
        <label
          className="mb-1.5 block text-sm font-semibold"
          htmlFor="password"
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
          placeholder="********"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-leaf"
        />
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      <button
        disabled={busy}
        className="w-full rounded-xl bg-leaf px-4 py-3 font-bold text-white hover:bg-emerald-800 disabled:opacity-60"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center px-5 py-10">
      <div className="w-full max-w-md rounded-3xl border border-black/5 bg-white p-6 shadow-soft sm:p-9">
        <Link href="/">
          <Brand />
        </Link>
        <h1 className="mt-8 text-3xl font-extrabold">Welcome back</h1>
        <p className="mt-2 text-slate-600">
          Sign in to manage your pantry and shop workspace.
        </p>
        <Suspense
          fallback={
            <p className="mt-6 text-sm text-slate-500">Loading sign-in…</p>
          }
        >
          <LoginForm />
        </Suspense>
        <p className="mt-6 text-center text-sm text-slate-600">
          New to SmartPantry?{" "}
          <Link href="/signup" className="font-bold text-leaf hover:underline">
            Create an account
          </Link>
        </p>
        <p className="mt-5 text-center text-xs leading-5 text-slate-400">
          Authentication is handled by Supabase. Your password is never stored
          by this application.
        </p>
      </div>
    </main>
  );
}
