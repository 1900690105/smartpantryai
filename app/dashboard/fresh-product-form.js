"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { registerFreshProduct } from "./actions";
import { Sprout, QrCode, Copy, Check } from "lucide-react";

export default function FreshProductForm() {
  const [product, setProduct] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  async function submit(fd) {
    setBusy(true);
    setError("");
    const result = await registerFreshProduct(fd);
    setBusy(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setProduct(result.product);
  }
  const url =
    product && typeof window !== "undefined"
      ? `${window.location.origin}/pantry/${product.id}`
      : "";
  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError("Could not copy the link. You can select and copy it manually.");
    }
  }
  return (
    <div className="space-y-4">
      {!product ? (
        <form action={submit} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label
              htmlFor="fresh-name"
              className="mb-1 block text-sm font-semibold"
            >
              Product name
            </label>
            <input
              id="fresh-name"
              name="name"
              required
              minLength={2}
              maxLength={120}
              placeholder="e.g. Local tomatoes"
              className="w-full rounded-xl border border-slate-200 px-3 py-3"
            />
          </div>
          <div>
            <label
              htmlFor="fresh-category"
              className="mb-1 block text-sm font-semibold"
            >
              Category
            </label>
            <select
              id="fresh-category"
              name="category"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3"
            >
              {[
                ["vegetable", "Vegetable"],
                ["fruit", "Fruit"],
                ["grain", "Grain / pulses"],
                ["dairy", "Dairy"],
                ["other", "Other"],
              ].map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="fresh-unit"
              className="mb-1 block text-sm font-semibold"
            >
              Selling unit
            </label>
            <select
              id="fresh-unit"
              name="unit"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3"
            >
              {["kg", "g", "pcs", "pack"].map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="fresh-price"
              className="mb-1 block text-sm font-semibold"
            >
              Price (₹, optional)
            </label>
            <input
              id="fresh-price"
              name="price"
              type="number"
              min="0"
              step="0.01"
              defaultValue="0"
              className="w-full rounded-xl border border-slate-200 px-3 py-3"
            />
          </div>
          <div>
            <label
              htmlFor="fresh-nutrition"
              className="mb-1 block text-sm font-semibold"
            >
              Nutrition / source notes
            </label>
            <input
              id="fresh-nutrition"
              name="nutrition_notes"
              maxLength={1000}
              placeholder="Optional; source or variety"
              className="w-full rounded-xl border border-slate-200 px-3 py-3"
            />
          </div>
          <label className="block text-sm font-semibold">
            Expiry date
            <input
              type="date"
              name="expiry_date"
              min={new Date().toISOString().split("T")[0]}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-normal"
            />
            <span className="mt-1 block text-xs font-normal text-slate-500">
              Optional for fresh produce when the exact date is unknown.
            </span>
          </label>

          <label className="block text-sm font-semibold">
            Freshness information
            <select
              name="expiry_type"
              defaultValue="unknown"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-normal"
            >
              <option value="printed">Printed expiry / use-by date</option>
              <option value="estimated">Estimated freshness date</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>
          <p className="text-xs leading-5 text-slate-500 sm:col-span-2">
            A unique QR is generated after saving. Fresh-product nutrition may
            be estimated from general reference data; owner notes alone are not
            verified nutrition facts.
          </p>
          {error && (
            <p role="alert" className="text-sm text-red-700 sm:col-span-2">
              {error}
            </p>
          )}
          <button
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-leaf px-4 py-3 font-bold text-white disabled:opacity-60 sm:col-span-2"
          >
            <QrCode size={18} />
            {busy ? "Registering…" : "Register product & generate QR"}
          </button>
        </form>
      ) : (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
          <div className="flex items-center gap-2 font-bold text-emerald-900">
            <Check size={18} /> Product registered: {product.name}
          </div>
          <div className="mt-4 flex flex-col items-center gap-3 rounded-xl bg-white p-4">
            <QRCodeSVG value={url} size={210} level="M" includeMargin />
            <p className="text-center text-sm font-semibold">
              Scan to view product details
            </p>
            <p className="break-all text-center text-xs text-slate-500">
              {url}
            </p>
            <button
              type="button"
              onClick={copyUrl}
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold"
            >
              <Copy size={15} />
              {copied ? "Copied" : "Copy product link"}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white"
            >
              Print QR
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setProduct(null);
              setCopied(false);
            }}
            className="mt-3 text-sm font-semibold text-leaf"
          >
            Register another product
          </button>
        </div>
      )}
    </div>
  );
}
