import Link from "next/link";
import { ArrowRight, Barcode, BellRing, ChartNoAxesCombined, CircleCheck, HeartHandshake, PackageCheck, ScanLine, ShoppingBasket, Store } from "lucide-react";
import Brand from "@/components/brand";

const features = [
  { icon: ScanLine, title: "Know what you buy", text: "Look up packaged products by barcode and review available ingredients and nutrition data." },
  { icon: PackageCheck, title: "A pantry that stays current", text: "Track quantities by batch, record expiry dates separately, and spot items that need attention." },
  { icon: Store, title: "Tools for local shops", text: "Manage products, stock and simple scan-to-cart billing from a phone, tablet or desktop." },
  { icon: HeartHandshake, title: "Make surplus useful", text: "Record donation offers and track verified handover status with community partners." },
];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Brand />
        <div className="flex items-center gap-2">
          <Link href="/login" className="rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-white">Log in</Link>
          <Link href="/signup" className="rounded-xl bg-leaf px-4 py-2.5 text-sm font-semibold text-white shadow-soft hover:bg-emerald-800">Get started</Link>
        </div>
      </header>
      <section className="mx-auto grid max-w-7xl items-center gap-10 px-5 pb-16 pt-8 sm:px-8 md:grid-cols-[1.08fr_.92fr] md:pb-24 md:pt-16">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-900/10 bg-white px-3 py-1.5 text-sm font-semibold text-leaf"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Smarter groceries. Less waste.</div>
          <h1 className="max-w-2xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">Every grocery, <span className="text-leaf">accounted for.</span></h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">One connected workspace for households and grocery shops to understand products, manage stock, catch expiry dates early and redirect eligible surplus to people who can use it.</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link href="/signup" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-leaf px-6 py-3.5 font-bold text-white shadow-soft hover:bg-emerald-800">Create free account <ArrowRight size={18} /></Link>
            <a href="#how-it-works" className="inline-flex items-center justify-center rounded-2xl border border-black/10 bg-white px-6 py-3.5 font-bold hover:bg-slate-50">Explore the workflow</a>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
            {["Batch-level expiry tracking", "Transparent product data", "Verified donation flow"].map(x => <span key={x} className="inline-flex items-center gap-1.5"><CircleCheck size={16} className="text-leaf" />{x}</span>)}
          </div>
        </div>
        <div className="relative">
          <div className="absolute -inset-4 rounded-[2.5rem] bg-emerald-100/70 blur-2xl" />
          <div className="relative rounded-[2rem] border border-white bg-white p-4 shadow-soft sm:p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div><p className="text-sm text-slate-500">Pantry overview</p><h2 className="mt-1 text-xl font-bold">Your kitchen, in sync</h2></div>
              <span className="rounded-xl bg-mint p-3 text-leaf"><ShoppingBasket /></span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-cream p-4"><p className="text-sm text-slate-500">Items tracked</p><p className="mt-2 text-3xl font-extrabold">24</p><p className="mt-1 text-xs text-slate-500">Illustrative preview</p></div>
              <div className="rounded-2xl bg-amber-50 p-4"><p className="text-sm text-amber-800">Use soon</p><p className="mt-2 text-3xl font-extrabold text-amber-950">03</p><p className="mt-1 text-xs text-amber-800">Check batch dates</p></div>
            </div>
            <div className="mt-4 space-y-3">
              {[["Whole milk", "Use today", "bg-amber-100 text-amber-800"], ["Brown bread", "2 days left", "bg-emerald-100 text-emerald-800"], ["Chickpeas", "Stock healthy", "bg-slate-100 text-slate-600"]].map(([name, status, cls], i) => <div key={name} className="flex items-center gap-3 rounded-2xl border border-slate-100 p-3"><div className={`grid h-11 w-11 place-items-center rounded-xl ${i===0?"bg-sky-50":i===1?"bg-orange-50":"bg-emerald-50"}`}><PackageCheck size={20} /></div><div className="min-w-0 flex-1"><p className="truncate font-semibold">{name}</p><p className="text-xs text-slate-500">Inventory batch</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{status}</span></div>)}
            </div>
            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-ink p-4 text-white"><div className="rounded-xl bg-white/10 p-2"><BellRing /></div><div><p className="font-semibold">A useful nudge, at the right time</p><p className="mt-1 text-xs text-white/70">Use-soon alerts are based on the dates you record.</p></div></div>
          </div>
        </div>
      </section>
      <section id="how-it-works" className="border-y border-black/5 bg-white py-14 sm:py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="max-w-2xl"><p className="text-sm font-bold uppercase tracking-[.18em] text-leaf">One connected loop</p><h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">From product data to better outcomes.</h2><p className="mt-4 leading-7 text-slate-600">SmartPantry AI connects everyday stock decisions to practical actions, instead of being only a barcode scanner or a chatbot.</p></div>
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{features.map(({icon:Icon,title,text},i)=><article key={title} className="rounded-3xl border border-slate-100 bg-cream p-5"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-mint text-leaf"><Icon /></div><p className="mt-5 text-xs font-bold uppercase tracking-wider text-slate-400">0{i+1}</p><h3 className="mt-1 text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></article>)}</div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20"><div className="flex flex-col justify-between gap-6 rounded-[2rem] bg-ink p-7 text-white sm:p-10 md:flex-row md:items-center"><div className="max-w-2xl"><h2 className="text-2xl font-extrabold sm:text-3xl">Start with the food you already have.</h2><p className="mt-3 leading-7 text-white/70">Create your account and begin tracking inventory. Add verified data and rewards as your workflow grows.</p></div><Link href="/signup" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 font-bold text-ink hover:bg-emerald-50">Start SmartPantry <ArrowRight size={18} /></Link></div></section>
      <footer className="border-t border-black/5 px-5 py-6 text-center text-sm text-slate-500">SmartPantry AI · A food-waste prevention and smart-retail prototype</footer>
    </main>
  );
}
