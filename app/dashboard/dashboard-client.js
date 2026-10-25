"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { addInventoryBatch, createDonationOffer, recordInventoryEvent, redeemDemoReward } from "./actions";
import InventoryForm from "./inventory-form";
import ProductLookup from "./product-lookup";
import FreshProductForm from "./fresh-product-form";
import { formatCurrency, formatDate, daysUntil } from "@/lib/utils";
import { AlertTriangle, ArrowDownToLine, ArrowUpRight, BadgeCheck, Barcode, Bell, Boxes, CircleDollarSign, Clock3, Gift, HeartHandshake, Leaf, Package, Plus, ScanLine, ShoppingBasket, Store, Trash2, Utensils, Wallet } from "lucide-react";
import LogoutButton from "@/components/logout-button";

function Stat({ icon: Icon, label, value, note }) {
  return <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-soft sm:p-5"><div className="flex items-center justify-between"><p className="text-sm text-slate-500">{label}</p><span className="rounded-xl bg-mint p-2 text-leaf"><Icon size={19}/></span></div><p className="mt-3 text-2xl font-extrabold tracking-tight">{value}</p><p className="mt-1 text-xs text-slate-500">{note}</p></div>;
}

export default function DashboardClient({ initialBatches, initialEvents, initialDonations, initialCredits, rewards, user, profile }) {
  const [batches, setBatches] = useState(initialBatches);
  const [events, setEvents] = useState(initialEvents);
  const [donations, setDonations] = useState(initialDonations);
  const [credits, setCredits] = useState(initialCredits);
  const [preset, setPreset] = useState(null);
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");
  const [eventForms, setEventForms] = useState({});
  const role = profile?.account_type || user?.user_metadata?.account_type || "household";
  const name = profile?.full_name || user?.user_metadata?.full_name || user.email?.split("@")[0] || "there";

  const stats = useMemo(() => {
    const active = batches.filter(b => Number(b.quantity) > 0);
    const expiring = active.filter(b => {
      const d = daysUntil(b.expiry_date);
      return d !== null && d >= 0 && d <= 3;
    }).length;
    const totalValue = active.reduce((sum,b)=>sum + Number(b.quantity) * Number(b.unit_cost || 0),0);
    return { active: active.length, expiring, totalValue };
  }, [batches]);

  function refreshMessage(msg) { setNotice(msg); }
  function refreshPage() { window.location.reload(); }

  async function submitEvent(e, batch) {
    e.preventDefault();
    setNotice("");
    const formData = new FormData(e.currentTarget);
    formData.set("batch_id", batch.id);
    setBusyId(batch.id);
    const result = await recordInventoryEvent(formData);
    setBusyId("");
    if (result?.error) { setNotice(result.error); return; }
    setNotice("Inventory updated successfully.");
    refreshPage();
  }

  async function donate(e, batch) {
    e.preventDefault();
    setNotice("");
    const formData = new FormData(e.currentTarget);
    formData.set("batch_id", batch.id);
    setBusyId(batch.id);
    const result = await createDonationOffer(formData);
    setBusyId("");
    if (result?.error) { setNotice(result.error); return; }
    setNotice("Donation offer recorded. Credits are pending until receipt is verified.");
    refreshPage();
  }

  async function redeem(e, reward) {
    e.preventDefault();
    setNotice("");
    setBusyId(reward.id);
    const fd = new FormData(); fd.set("reward_id", reward.id);
    const result = await redeemDemoReward(fd);
    setBusyId("");
    if (result?.error) { setNotice(result.error); return; }
    setNotice("Reward redemption recorded.");
    refreshPage();
  }

  return <main className="min-h-screen">
    <header className="border-b border-black/5 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8"><Link href="/" className="flex items-center gap-2 font-extrabold"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-mint text-leaf"><Leaf size={21}/></span><span>SmartPantry <span className="text-leaf">AI</span></span></Link><div className="flex items-center gap-3"><div className="hidden text-right sm:block"><p className="text-sm font-bold">{name}</p><p className="text-xs capitalize text-slate-500">{role} account</p></div><LogoutButton/></div></div>
    </header>
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold text-leaf">YOUR WORKSPACE</p><h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">Good day, {name.split(" ")[0]}.</h1><p className="mt-2 max-w-2xl text-slate-600">Keep products moving, not forgotten. Your stock and credit ledger update as you record actions.</p></div><div className="flex flex-wrap gap-2"><a href="#add-stock" className="inline-flex items-center gap-2 rounded-xl bg-leaf px-4 py-2.5 text-sm font-bold text-white"><Plus size={17}/> Add stock</a><a href="#credits" className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-bold"><Wallet size={17}/> Credits</a></div></div>
      {notice && <div role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{notice}</div>}
      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Boxes} label="Active stock batches" value={stats.active} note="Batches with stock remaining"/>
        <Stat icon={Clock3} label="Use soon" value={stats.expiring} note="Recorded dates within 3 days"/>
        <Stat icon={CircleDollarSign} label="Tracked stock value" value={formatCurrency(stats.totalValue)} note="Quantity × recorded unit cost"/>
        <Stat icon={Wallet} label="Available credits" value={credits} note="Verified ledger balance"/>
      </section>

      <div className="mt-7 grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
        <section className="space-y-6">
          <div className="rounded-3xl border border-black/5 bg-white p-5 shadow-soft sm:p-6">
            <div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-extrabold">Product scanner</h2><p className="mt-1 text-sm text-slate-500">Look up a barcode and prefill product name when data is available.</p></div><span className="rounded-xl bg-mint p-3 text-leaf"><ScanLine/></span></div>
            <div className="mt-4"><ProductLookup onFound={product=>{setPreset({name: product.name || "", source:"barcode"}); setNotice(product.note || "Product found. Review its details before saving."); document.getElementById("product-name")?.focus();}} /></div>
          </div>

          <div className="rounded-3xl border border-black/5 bg-white p-5 shadow-soft sm:p-6">
            <div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-extrabold">Register fresh / unlabelled product</h2><p className="mt-1 text-sm text-slate-500">For vegetables, fruits, loose grains, or products without a manufacturer barcode. Register once to generate a unique QR code.</p></div><span className="rounded-xl bg-mint p-3 text-leaf"><ScanLine/></span></div>
            <div className="mt-4"><FreshProductForm/></div>
          </div>

          <div id="add-stock" className="rounded-3xl border border-black/5 bg-white p-5 shadow-soft sm:p-6">
            <div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-extrabold">Add inventory batch</h2><p className="mt-1 text-sm text-slate-500">Expiry belongs to each batch, not the barcode. Confirm package dates yourself.</p></div><span className="rounded-xl bg-mint p-3 text-leaf"><Plus/></span></div>
            <div className="mt-5"><InventoryForm key={preset?.name || "empty"} preset={preset} onDone={()=>setPreset(null)}/></div>
          </div>

          <div className="rounded-3xl border border-black/5 bg-white p-5 shadow-soft sm:p-6">
            <div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-extrabold">Inventory</h2><p className="mt-1 text-sm text-slate-500">Record consumption, avoidable waste, sales or a donation offer.</p></div><span className="rounded-xl bg-mint p-3 text-leaf"><Package/></span></div>
            {batches.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-slate-200 p-7 text-center"><ShoppingBasket className="mx-auto text-slate-400" size={28}/><p className="mt-3 font-bold">Your pantry is ready for its first item</p><p className="mt-1 text-sm text-slate-500">Add a batch above or look up a product by barcode.</p></div> :
              <div className="mt-5 space-y-3">{batches.map(batch=>{
                const days = daysUntil(batch.expiry_date);
                const soon = days !== null && days >= 0 && days <= 3 && Number(batch.quantity)>0;
                return <article key={batch.id} className="rounded-2xl border border-slate-100 p-4">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="break-words font-bold">{batch.product_name}</h3>{soon&&<span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900"><AlertTriangle size={12}/>Use soon</span>}</div><p className="mt-1 text-sm text-slate-500">{batch.quantity} {batch.unit} remaining · Added {formatDate(batch.created_at)}</p><p className="mt-1 text-xs text-slate-500">{batch.expiry_date ? `Expiry / best-before: ${formatDate(batch.expiry_date)}` : "No expiry date recorded"} · Value {formatCurrency(Number(batch.quantity)*Number(batch.unit_cost||0))}</p></div><span className="shrink-0 rounded-xl bg-cream px-3 py-2 text-xs font-semibold text-slate-600">{Number(batch.quantity)>0?"In stock":"Empty"}</span></div>
                  {Number(batch.quantity)>0&&<div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-2">
                    <form onSubmit={e=>submitEvent(e,batch)} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="batch_id" value={batch.id}/>
                      <div className="min-w-0 flex-1"><label htmlFor={`qty-${batch.id}`} className="mb-1 block text-xs font-semibold text-slate-600">Quantity</label><input id={`qty-${batch.id}`} name="quantity" type="number" min="0.001" step="any" max={batch.quantity} required defaultValue="1" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"/></div>
                      <div><label htmlFor={`event-${batch.id}`} className="mb-1 block text-xs font-semibold text-slate-600">Action</label><select id={`event-${batch.id}`} name="event_type" className="max-w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"><option value="consume">Consumed</option><option value="waste">Avoidable waste</option><option value="sale">Sold</option></select></div>
                      <div className="w-full"><label htmlFor={`reason-${batch.id}`} className="mb-1 block text-xs font-semibold text-slate-600">Reason (required for waste)</label><input id={`reason-${batch.id}`} name="reason" maxLength="200" placeholder="e.g. forgotten until spoiled" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"/></div>
                      <button disabled={busyId===batch.id} className="w-full rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{busyId===batch.id?"Saving…":"Record update"}</button>
                    </form>
                    <form onSubmit={e=>donate(e,batch)} className="flex flex-col gap-2 rounded-xl bg-emerald-50/70 p-3">
                      <p className="text-sm font-bold text-emerald-950">Offer surplus for donation</p><p className="text-xs leading-5 text-emerald-900/70">This records an offer only. Inventory is not deducted and donation credits remain pending until verified receipt.</p><label htmlFor={`donate-${batch.id}`} className="text-xs font-semibold text-emerald-950">Quantity to offer ({batch.unit})</label><input id={`donate-${batch.id}`} name="quantity" type="number" min="0.001" step="any" max={batch.quantity} required defaultValue={Math.min(1, Number(batch.quantity))} className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"/><label htmlFor={`notes-${batch.id}`} className="text-xs font-semibold text-emerald-950">Notes (optional)</label><input id={`notes-${batch.id}`} name="notes" maxLength="300" placeholder="Collection window, condition…" className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"/><button disabled={busyId===batch.id} className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-700 px-3 py-2 text-sm font-bold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"><HeartHandshake size={16}/>Create donation offer</button>
                    </form>
                  </div>}
                </article>;
              })}</div>
            }
          </div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-3xl bg-ink p-5 text-white shadow-soft sm:p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-white/60">Your impact starts with records</p><h2 className="mt-1 text-xl font-extrabold">Small actions add up.</h2></div><span className="rounded-xl bg-white/10 p-3"><Leaf/></span></div><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-white/10 p-4"><p className="text-sm text-white/60">Logged events</p><p className="mt-2 text-2xl font-extrabold">{events.length}</p></div><div className="rounded-2xl bg-white/10 p-4"><p className="text-sm text-white/60">Donation offers</p><p className="mt-2 text-2xl font-extrabold">{donations.length}</p></div></div><p className="mt-4 text-xs leading-5 text-white/60">This prototype reports recorded actions. It does not claim food waste was reduced unless outcomes are verified and compared with a baseline.</p></section>

          <section id="credits" className="rounded-3xl border border-black/5 bg-white p-5 shadow-soft sm:p-6"><div className="flex items-center justify-between"><div><h2 className="text-xl font-extrabold">Credit wallet</h2><p className="mt-1 text-sm text-slate-500">Only verified credits are spendable.</p></div><span className="rounded-xl bg-amber-50 p-3 text-amber-800"><Wallet/></span></div><div className="mt-4 rounded-2xl bg-cream p-4"><p className="text-sm text-slate-500">Available balance</p><p className="mt-1 text-3xl font-extrabold">{credits} <span className="text-base font-semibold text-slate-500">credits</span></p></div><div className="mt-4 space-y-3">{initialEvents.slice(0,4).map(event=><div key={event.id} className="flex items-start gap-3"><span className={`mt-0.5 rounded-lg p-2 ${event.event_type==="waste"?"bg-amber-50 text-amber-800":"bg-mint text-leaf"}`}>{event.event_type==="waste"?<Trash2 size={16}/>:<Utensils size={16}/>}</span><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{event.event_type==="waste"?"Waste recorded":event.event_type==="consume"?"Consumption recorded":"Sale recorded"}</p><p className="text-xs text-slate-500">{formatDate(event.created_at)} · {event.quantity} {event.unit}</p></div><span className="text-xs font-bold text-slate-500">Logged</span></div>)}
              {initialEvents.length===0&&<p className="text-sm text-slate-500">Your activity ledger will appear here.</p>}</div><p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">Safety-first rule: discarding spoiled, contaminated or recalled food must never be penalized. This MVP does not automatically award donation credits; verification by an authorized partner is required.</p></section>

          <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-soft sm:p-6"><div className="flex items-center justify-between"><div><h2 className="text-xl font-extrabold">Donation status</h2><p className="mt-1 text-sm text-slate-500">Offers are not the same as rescued food.</p></div><span className="rounded-xl bg-mint p-3 text-leaf"><HeartHandshake/></span></div><div className="mt-4 space-y-3">{donations.length===0?<p className="text-sm text-slate-500">No donation offers yet.</p>:donations.map(d=><div key={d.id} className="rounded-xl border border-slate-100 p-3"><div className="flex items-center justify-between gap-2"><p className="font-semibold">{d.product_name}</p><span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold capitalize text-amber-900">{d.status}</span></div><p className="mt-1 text-xs text-slate-500">{d.quantity} {d.unit} · {formatDate(d.created_at)}</p></div>)}</div></section>

          <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-soft sm:p-6"><div className="flex items-center justify-between"><div><h2 className="text-xl font-extrabold">Rewards catalogue</h2><p className="mt-1 text-sm text-slate-500">Demo rewards; define real partner terms before launch.</p></div><Gift className="text-leaf"/></div><div className="mt-4 space-y-3">{rewards.map(reward=><form key={reward.id} onSubmit={e=>redeem(e,reward)} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-800"><Gift size={18}/></div><div className="min-w-0 flex-1"><p className="font-semibold">{reward.name}</p><p className="text-xs text-slate-500">{reward.cost_credits} credits</p></div><button disabled={busyId===reward.id} className="rounded-lg border border-black/10 px-3 py-2 text-xs font-bold hover:bg-cream disabled:opacity-50">{busyId===reward.id?"…":"Redeem"}</button></form>)}</div></section>
        </aside>
      </div>
      <footer className="py-8 text-center text-xs text-slate-400">SmartPantry AI · Prototype · Verify all product and expiry details before acting.</footer>
    </div>
  </main>;
}
