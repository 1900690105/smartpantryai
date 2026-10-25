"use client";

import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { Copy, ExternalLink, QrCode, CalendarDays } from "lucide-react";

function getExpiryStatus(expiryDate) {
  if (!expiryDate) return null;

  // Compare calendar dates rather than elapsed hours.
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(`${expiryDate}T00:00:00`);
  if (Number.isNaN(expiry.getTime())) return null;

  const daysRemaining = Math.round(
    (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysRemaining < 0) {
    return {
      label: "Expired",
      className: "bg-red-50 text-red-700",
    };
  }

  if (daysRemaining <= 3) {
    return {
      label:
        daysRemaining === 0
          ? "Expires today"
          : `Expires in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`,
      className: "bg-amber-50 text-amber-800",
    };
  }

  return {
    label: `Expires ${expiry.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })}`,
    className: "bg-emerald-50 text-emerald-800",
  };
}

export default function QRProductList({ products }) {
  const [copied, setCopied] = useState("");
  const [origin, setOrigin] = useState("");

  // Read browser origin only after hydration to avoid server/client markup differences.
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  async function copy(id, url) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(id);
    } catch {
      setCopied("error");
    }
  }

  if (!products.length) {
    return (
      <p className="rounded-xl bg-cream p-4 text-sm text-slate-600">
        No products registered yet. Create a fresh-product listing to generate
        its QR code.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {products.map((p) => {
        const url = origin ? `${origin}/pantry/${p.id}` : "";
        const expiryStatus = getExpiryStatus(p.expiry_date);

        const expiryTypeLabel =
          {
            printed: "Printed expiry date",
            estimated: "Estimated expiry date",
            unknown: "Expiry date unknown",
          }[p.expiry_type] || "Expiry type not specified";

        return (
          <article
            key={p.id}
            className="rounded-2xl border border-slate-100 p-4"
          >
            <div className="flex gap-4">
              <div className="shrink-0 rounded-xl bg-white p-2">
                <QRCodeSVG
                  value={url || `https://example.invalid/pantry/${p.id}`}
                  size={100}
                  level="M"
                />
              </div>

              <div className="min-w-0">
                <h3 className="font-bold">{p.name}</h3>

                <p className="mt-1 text-sm capitalize text-slate-500">
                  {p.category} · {p.unit}
                </p>

                <p className="mt-1 text-sm font-semibold">
                  ₹{Number(p.price).toFixed(2)}
                </p>

                <p className="mt-2 text-xs text-slate-500">
                  {p.active ? "Active listing" : "Inactive listing"}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-cream p-3">
              <div className="flex items-start gap-2">
                <CalendarDays size={17} className="mt-0.5 shrink-0 text-leaf" />

                <div className="min-w-0">
                  <p className="text-sm font-semibold">Expiry information</p>

                  <p className="mt-1 text-xs text-slate-600">
                    {p.expiry_date
                      ? new Date(
                          `${p.expiry_date}T00:00:00`,
                        ).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "No expiry date provided"}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {expiryTypeLabel}
                  </p>

                  {expiryStatus && (
                    <span
                      className={`mt-2 inline-block rounded-full px-2 py-1 text-xs font-bold ${expiryStatus.className}`}
                    >
                      {expiryStatus.label}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => copy(p.id, url)}
                disabled={!origin}
                className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50"
              >
                <Copy size={13} />
                {copied === p.id ? "Copied" : "Copy link"}
              </button>

              <a
                href={url || "#"}
                onClick={(event) => {
                  if (!origin) event.preventDefault();
                }}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg bg-ink px-3 py-2 text-xs font-bold text-white"
              >
                <ExternalLink size={13} />
                View page
              </a>

              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold"
              >
                <QrCode size={13} />
                Print
              </button>
            </div>

            {copied === "error" && (
              <p className="mt-2 text-xs text-red-700">
                Clipboard access was blocked. Open the product page and copy its
                URL manually.
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}
