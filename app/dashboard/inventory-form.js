"use client";

import { useState } from "react";
import { addInventoryBatch } from "./actions";
import { Plus } from "lucide-react";

export default function InventoryForm({ preset, onDone }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(formData) {
    setBusy(true); setMessage("");
    const result = await addInventoryBatch(formData);
    setBusy(false);
    if (result?.error) { setMessage(result.error); return; }
    setMessage("Inventory batch added.");
    onDone?.();
    document.getElementById("inventory-form")?.reset();
  }
  return <form id="inventory-form" action={submit} className="grid gap-3 sm:grid-cols-2">
    <div className="sm:col-span-2"><label htmlFor="product-name" className="mb-1.5 block text-sm font-semibold">Product name</label><input id="product-name" name="name" required maxLength={120} defaultValue={preset?.name || ""} placeholder="e.g. Whole wheat bread" className="w-full rounded-xl border border-slate-200 px-3.5 py-3 outline-none focus:border-leaf" /></div>
    <div><label htmlFor="quantity" className="mb-1.5 block text-sm font-semibold">Quantity</label><input id="quantity" name="quantity" type="number" min="0.001" max="100000" step="any" required defaultValue="1" className="w-full rounded-xl border border-slate-200 px-3.5 py-3 outline-none focus:border-leaf" /></div>
    <div><label htmlFor="unit" className="mb-1.5 block text-sm font-semibold">Unit</label><select id="unit" name="unit" defaultValue="pcs" className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 outline-none focus:border-leaf">{["pcs","pack","g","kg","ml","l"].map(u=><option key={u}>{u}</option>)}</select></div>
    <div><label htmlFor="expiry" className="mb-1.5 block text-sm font-semibold">Expiry / best-before date</label><input id="expiry" name="expiry_date" type="date" min="2000-01-01" className="w-full rounded-xl border border-slate-200 px-3.5 py-3 outline-none focus:border-leaf" /></div>
    <div><label htmlFor="cost" className="mb-1.5 block text-sm font-semibold">Unit cost (₹, optional)</label><input id="cost" name="unit_cost" type="number" min="0" max="10000000" step="0.01" defaultValue="0" className="w-full rounded-xl border border-slate-200 px-3.5 py-3 outline-none focus:border-leaf" /></div>
    <input type="hidden" name="source" value={preset?.source || "manual"} />
    {message && <p role="status" className="text-sm text-slate-600 sm:col-span-2">{message}</p>}
    <button disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-leaf px-4 py-3 font-bold text-white hover:bg-emerald-800 disabled:opacity-60 sm:col-span-2"><Plus size={18}/>{busy ? "Saving…" : "Add to inventory"}</button>
  </form>;
}
