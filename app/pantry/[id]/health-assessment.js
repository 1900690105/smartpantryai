"use client";

import { useMemo, useState, useTransition } from "react";
import {
  HeartPulse,
  ShieldAlert,
  Sparkles,
  ShoppingCart,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { addInventoryBatch } from "@/app/dashboard/actions";

function assess(product, profile) {
  const category = String(product.category || "other").toLowerCase();
  const notes = String(product.nutrition_notes || "").toLowerCase();

  let score =
    { vegetable: 88, fruit: 85, grain: 70, dairy: 65, other: 55 }[category] ??
    55;

  const reasons = [];

  if (["vegetable", "fruit"].includes(category)) {
    reasons.push(
      "Fresh produce can contribute fibre and micronutrients as part of a varied diet.",
    );
  } else {
    reasons.push(
      "This estimate is based on the registered product category, not a laboratory nutrition analysis.",
    );
  }

  if (
    profile.allergies.trim() &&
    notes &&
    profile.allergies
      .toLowerCase()
      .split(",")
      .some((a) => a.trim() && notes.includes(a.trim()))
  ) {
    score = Math.min(score, 15);
    reasons.push(
      "A possible allergy match was found in the product notes. Verify the ingredients before consuming.",
    );
  } else if (profile.allergies.trim()) {
    reasons.push(
      "Allergen safety cannot be confirmed from these product notes.",
    );
  }

  if (profile.goal === "lower-sugar" && /sugar|sweet/.test(notes)) {
    score -= 15;
    reasons.push("Owner notes mention sugar; the amount is not quantified.");
  }

  if (profile.goal === "lower-salt" && /salt|sodium/.test(notes)) {
    score -= 10;
    reasons.push(
      "Owner notes mention salt/sodium; the amount is not quantified.",
    );
  }

  if (profile.condition === "diabetes" && category === "fruit") {
    reasons.push(
      "For diabetes, portion size and total carbohydrate matter. This generic score cannot predict individual glucose response.",
    );
  }

  score = Math.max(0, Math.min(100, score));

  const fit =
    score >= 75
      ? "Likely a good fit"
      : score >= 45
        ? "Consider portions and details"
        : "Use caution";

  return { score, fit, reasons };
}

export default function HealthAssessment({ product, onRemoveFromList }) {
  const [condition, setCondition] = useState("none");
  const [goal, setGoal] = useState("balanced");
  const [allergies, setAllergies] = useState("");

  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState(product.unit || "pcs");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [isPending, startTransition] = useTransition();
  const [isRemoving, setIsRemoving] = useState(false);

  console.log("FULL PRODUCT OBJECT:", product);
  console.log("PRODUCT NAME:", product?.name);
  console.log("PRODUCT KEYS:", Object.keys(product ?? {}));

  const result = useMemo(
    () => assess(product, { condition, goal, allergies }),
    [product, condition, goal, allergies],
  );

  const normalizedProduct = {
    ...product,
    name:
      product?.name ||
      product?.product_name ||
      product?.product_details?.product_name ||
      "",
  };

  const productName =
    [
      product?.name,
      product?.product_name,
      product?.title,
      product?.productName,
      product?.product_details?.product_name,
      product?.product_details?.name,
      product?.product?.product_name,
      product?.product?.name,
      product?.productData?.product_name,
      product?.productData?.name,
      product?.food?.product_name,
    ]
      .find((value) => typeof value === "string" && value.trim().length > 0)
      ?.trim() || "";

  const addToInventory = () => {
    setMessage("");
    const parsedQuantity = Number(quantity);

    if (!productName) {
      console.error("Product name not found. Received product:", product);

      setMessageType("error");
      setMessage(
        "Product name is missing. Please check the product details and try again.",
      );
      return;
    }

    if (
      !Number.isFinite(parsedQuantity) ||
      parsedQuantity <= 0 ||
      parsedQuantity > 100000
    ) {
      setMessageType("error");
      setMessage("Enter a quantity greater than 0 and no more than 100000.");
      return;
    }

    const formData = new FormData();
    formData.set("name", productName.trim());
    formData.set("quantity", String(parsedQuantity));
    formData.set("unit", unit);
    formData.set("unit_cost", String(Number(product.price) || 0));
    formData.set(
      "source",
      product.source_type === "open_food_facts" || product.barcode
        ? "barcode"
        : "manual",
    );

    startTransition(async () => {
      try {
        const response = await addInventoryBatch(formData);

        if (response?.error) {
          setMessageType("error");
          setMessage(response.error);
          return;
        }

        setMessageType("success");
        setMessage(`${productName} added to your inventory successfully.`);
      } catch {
        setMessageType("error");
        setMessage("Could not save the product. Please try again.");
      }
    });
  };

  const removeFromList = async () => {
    if (typeof onRemoveFromList !== "function") {
      setMessageType("error");
      setMessage(
        "Remove action is not connected yet. Pass an onRemoveFromList callback from the list page.",
      );
      return;
    }

    setIsRemoving(true);
    setMessage("");

    try {
      await onRemoveFromList(product);
      setMessageType("success");
      setMessage(`${productName} removed from your list.`);
    } catch {
      setMessageType("error");
      setMessage("Could not remove the product from your list.");
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="mt-6 border-t border-slate-100 pt-5">
      <div className="flex items-center gap-2">
        <Sparkles className="text-leaf" size={20} />
        <h2 className="text-xl font-extrabold">AI-assisted health fit</h2>
      </div>

      <p className="mt-1 text-sm leading-6 text-slate-500">
        Personalize the guidance. This version uses transparent, category-based
        rules and owner notes; it does not invent exact calories, nutrients, or
        medical claims.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">
          Health context
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-normal"
          >
            <option value="none">No specific condition</option>
            <option value="diabetes">Diabetes</option>
            <option value="hypertension">High blood pressure</option>
            <option value="heart">Heart-health focus</option>
          </select>
        </label>

        <label className="text-sm font-semibold">
          Food goal
          <select
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-normal"
          >
            <option value="balanced">Balanced diet</option>
            <option value="lower-sugar">Lower sugar</option>
            <option value="lower-salt">Lower salt</option>
            <option value="weight">Weight management</option>
          </select>
        </label>
      </div>

      <label className="mt-3 block text-sm font-semibold">
        Allergies (comma separated)
        <input
          value={allergies}
          onChange={(e) => setAllergies(e.target.value)}
          maxLength={300}
          placeholder="e.g. peanuts, milk"
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal"
        />
      </label>

      <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-emerald-900">
              Estimated health-fit score
            </p>
            <p className="mt-1 text-2xl font-extrabold text-emerald-950">
              {result.score}/100
            </p>
          </div>

          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-leaf">
            <HeartPulse size={27} />
          </div>
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-emerald-100">
          <div
            className="h-full rounded-full bg-leaf transition-all"
            style={{ width: `${result.score}%` }}
          />
        </div>

        <p className="mt-3 font-bold text-emerald-950">{result.fit}</p>

        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-5 text-emerald-950">
          {result.reasons.map((reason, index) => (
            <li key={index}>{reason}</li>
          ))}
        </ul>
      </div>

      {/* Quantity and inventory actions */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-lg font-extrabold">Add to your pantry</h3>

        <p className="mt-1 text-sm text-slate-500">
          Bought this product? Enter the quantity you purchased to save it in
          your household inventory.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            Quantity
            <input
              type="number"
              min="0.001"
              max="100000"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal"
            />
          </label>

          <label className="text-sm font-semibold">
            Unit
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-normal"
            >
              {["pcs", "pack", "g", "kg", "ml", "l"].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={addToInventory}
            disabled={isPending || isRemoving}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-leaf px-4 py-3 font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? (
              "Saving..."
            ) : (
              <>
                <ShoppingCart size={18} />
                Buy / Add to Inventory
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => onRemoveFromList(product)}
            disabled={isPending || isRemoving}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-3 font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 size={18} />
            {isRemoving ? "Removing..." : "Remove from List"}
          </button>
        </div>

        {message && (
          <p
            role="status"
            aria-live="polite"
            className={`mt-3 flex items-start gap-2 text-sm ${
              messageType === "error"
                ? "text-red-700"
                : messageType === "success"
                  ? "text-emerald-700"
                  : "text-slate-600"
            }`}
          >
            {messageType === "success" && (
              <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
            )}
            {message}
          </p>
        )}
      </div>

      <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-amber-900">
        <ShieldAlert size={16} className="mt-0.5 shrink-0" />
        Do not use this score to make medical decisions. For severe allergies,
        verify ingredients directly with the seller or manufacturer. Exact
        nutrient-based personalization requires verified nutrition data.
      </p>
    </div>
  );
}
