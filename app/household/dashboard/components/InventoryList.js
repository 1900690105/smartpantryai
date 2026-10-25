"use client";

import { useState } from "react";

export default function InventoryList({ initialBatches }) {
  const [batches, setBatches] = useState(initialBatches);
  const [editingId, setEditingId] = useState(null);
  const [quantity, setQuantity] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function saveQuantity(inventoryId) {
    const remaining = Number(quantity);

    if (!Number.isFinite(remaining) || remaining < 0) {
      setError("Enter a valid remaining quantity.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/inventory/quantity", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inventoryId,
          quantity: remaining,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update quantity.");
      }

      setBatches((previous) =>
        previous.map((batch) =>
          batch.id === inventoryId
            ? { ...batch, quantity: result.quantity }
            : batch,
        ),
      );

      setEditingId(null);
      setQuantity("");
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function markAsFinished(inventoryId) {
    const confirmed = window.confirm(
      "Mark this product as finished? Its remaining quantity will become zero.",
    );

    if (!confirmed) return;

    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/inventory/quantity", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inventoryId,
          action: "mark_consumed",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not update product.");
      }

      setBatches((previous) =>
        previous.filter((batch) => batch.id !== inventoryId),
      );

      setEditingId(null);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  function startEditing(batch) {
    setEditingId(batch.id);
    setQuantity(String(batch.quantity));
    setError("");
  }

  return (
    <div className="space-y-3">
      {batches.map((batch) => (
        <article
          key={batch.id}
          className="rounded-xl border border-slate-100 p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900">{batch.product_name}</h3>

              <p className="mt-1 text-sm text-slate-500">
                Remaining: {batch.quantity} {batch.unit}
                {batch.expiry_date
                  ? ` · Best before ${batch.expiry_date}`
                  : " · No date recorded"}
              </p>
            </div>

            <button
              type="button"
              onClick={() => startEditing(batch)}
              className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Edit quantity
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => markAsFinished(batch.id)}
              className="shrink-0 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
            >
              Mark as Finished
            </button>
          </div>

          {editingId === batch.id && (
            <div className="mt-4 space-y-3">
              <label className="block text-sm font-medium text-slate-700">
                Remaining quantity ({batch.unit})
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-emerald-500"
                />
              </label>

              <p className="text-xs text-slate-500">
                Enter the remaining amount using the same unit as the inventory
                item.
              </p>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => saveQuantity(batch.id)}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save quantity"}
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setEditingId(null);
                    setError("");
                  }}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
