"use client";

import { useMemo, useState } from "react";
import {
  CalendarClock,
  ChefHat,
  Clock3,
  CookingPot,
  Sparkles,
  PackageCheck,
  AlertTriangle,
  CircleCheck,
} from "lucide-react";

function daysUntil(dateString) {
  if (!dateString) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return Math.round((date.getTime() - today.getTime()) / 86400000);
}

function formatExpiry(dateString) {
  if (!dateString) return "Expiry date not recorded";
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Expiry date unavailable";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatAmount(value, unit) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return "Quantity not verified";
  }
  const amount = Number.isInteger(Number(value))
    ? String(Number(value))
    : String(Number(Number(value).toFixed(3)));
  return `${amount}${unit ? ` ${unit}` : ""}`;
}

export default function MealPlanner({ inventory = [] }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [prioritizeExpiry, setPrioritizeExpiry] = useState(true);
  const [recipes, setRecipes] = useState([]);
  const [stockSummary, setStockSummary] = useState([]);
  const [unusedItems, setUnusedItems] = useState([]);
  const [activeRecipeId, setActiveRecipeId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const availableItems = useMemo(
    () => inventory.filter((item) => Number(item.quantity) > 0),
    [inventory]
  );

  const selectedItems = availableItems.filter((item) =>
    selectedIds.includes(item.id)
  );

  const hasExpiredSelection = selectedItems.some((item) => {
    const days = daysUntil(item.expiry_date);
    return days !== null && days < 0;
  });

  const soonCount = selectedItems.filter((item) => {
    const days = daysUntil(item.expiry_date);
    return days !== null && days >= 0 && days <= 3;
  }).length;

  function clearResults() {
    setRecipes([]);
    setStockSummary([]);
    setUnusedItems([]);
    setActiveRecipeId("");
    setError("");
    setNotice("");
  }

  function toggleItem(id, checked) {
    setSelectedIds((current) =>
      checked ? [...current, id] : current.filter((selectedId) => selectedId !== id)
    );
    clearResults();
  }

  async function generateMeals() {
    if (!selectedIds.length) {
      setError("Please select at least one pantry item.");
      return;
    }
    if (hasExpiredSelection) {
      setError("Deselect items with a past recorded expiry date before generating meal ideas.");
      return;
    }

    setGenerating(true);
    clearResults();

    try {
      const response = await fetch("/api/meal-planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedIds, prioritizeExpiry }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not generate meal suggestions.");
      }

      setRecipes(Array.isArray(data.recipes) ? data.recipes : []);
      setStockSummary(Array.isArray(data.stockSummary) ? data.stockSummary : []);
      setUnusedItems(Array.isArray(data.unusedItems) ? data.unusedItems : []);

      if (!data.recipes?.length) {
        setNotice(
          data.message ||
            "No suitable meals were generated. Try selecting a few more ingredients that work well together."
        );
      } else if (data.rejectedMeals?.length) {
        setNotice(
          `Some suggestions were excluded because their quantities could not be safely validated: ${data.rejectedMeals.join(", ")}.`
        );
      }
    } catch (err) {
      setError(err.message || "Meal generation failed. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <section className="space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <Sparkles size={20} className="text-leaf" />
          <h3 className="text-base font-extrabold">SmartPantry AI meal planner</h3>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Select the pantry items you want to use. Gemini creates meals dynamically,
          tries to use compatible ingredients across the meal plan, and tracks quantities
          so suggested use does not exceed selected stock.
        </p>
      </div>

      {!availableItems.length ? (
        <p className="rounded-xl bg-cream p-4 text-sm text-slate-600">
          No available inventory found. Add groceries to your pantry first.
        </p>
      ) : (
        <>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <input
              type="checkbox"
              checked={prioritizeExpiry}
              onChange={(event) => {
                setPrioritizeExpiry(event.target.checked);
                clearResults();
              }}
              className="mt-1 accent-emerald-700"
            />
            <span>
              <span className="block text-sm font-bold text-amber-950">
                Prioritize items expiring soon
              </span>
              <span className="mt-1 block text-xs leading-5 text-amber-900">
                Prefer sensible meals that use selected items expiring soon. Nothing is selected automatically.
              </span>
            </span>
          </label>

          <div className="space-y-2">
            <div>
              <h3 className="font-bold">Choose your ingredients</h3>
              <p className="mt-1 text-xs text-slate-500">
                Only selected products are sent to the meal planner. Unselected products are not used.
              </p>
            </div>

            {availableItems.map((item) => {
              const days = daysUntil(item.expiry_date);
              const expired = days !== null && days < 0;
              const soon = days !== null && days >= 0 && days <= 3;

              return (
                <label
                  key={item.id}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-emerald-300"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(item.id)}
                    onChange={(event) => toggleItem(item.id, event.target.checked)}
                    className="mt-1 accent-emerald-700"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-slate-900">
                      {item.product_name}
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">
                      Available: {item.quantity} {item.unit || ""}
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">
                      {formatExpiry(item.expiry_date)}
                    </span>
                    {expired && (
                      <span className="mt-2 inline-block rounded-full bg-red-50 px-2 py-1 text-xs font-bold text-red-700">
                        Past recorded expiry
                      </span>
                    )}
                    {!expired && soon && (
                      <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800">
                        <CalendarClock size={13} />
                        {days === 0 ? "Recorded expiry is today" : `Recorded expiry in ${days} day${days === 1 ? "" : "s"}`}
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>

          <div className="rounded-xl bg-cream p-3">
            <p className="text-sm font-semibold">
              {selectedItems.length} selected item{selectedItems.length === 1 ? "" : "s"}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {soonCount} selected item{soonCount === 1 ? "" : "s"} have a recorded expiry date within three days.
            </p>
          </div>

          {hasExpiredSelection && (
            <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm leading-5 text-red-800">
              One or more selected items have a past recorded expiry date. Deselect them before generating meals. A date alone cannot establish whether food is safe to eat.
            </p>
          )}
          {error && (
            <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm leading-5 text-red-800">{error}</p>
          )}
          {notice && (
            <p role="status" className="rounded-xl bg-cream p-3 text-sm leading-5 text-slate-700">{notice}</p>
          )}

          <button
            type="button"
            onClick={generateMeals}
            disabled={generating || selectedItems.length === 0 || hasExpiredSelection}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChefHat size={18} />
            {generating ? "Generating practical meal ideas…" : "Generate meal ideas"}
          </button>

          {generating && (
            <p className="text-center text-xs text-slate-500">
              Gemini is checking ingredient compatibility and preparing detailed cooking steps…
            </p>
          )}

          {recipes.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <ChefHat size={21} className="text-leaf" />
                <h3 className="font-extrabold">Your meal suggestions</h3>
              </div>
              <p className="text-xs leading-5 text-slate-500">
                Pantry quantities and remaining stock are calculated by the server. Review recipe amounts before cooking, especially when the inventory uses packets or other package units.
              </p>

              {recipes.map((recipe) => {
                const expanded = activeRecipeId === recipe.id;
                return (
                  <article key={recipe.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-900">{recipe.name}</h4>
                        {recipe.description && (
                          <p className="mt-1 text-sm leading-5 text-slate-600">{recipe.description}</p>
                        )}
                        <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                          <Clock3 size={13} />
                          About {recipe.time} minutes · {recipe.servings} serving{recipe.servings === 1 ? "" : "s"}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold ${
                        recipe.ready ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"
                      }`}>
                        {recipe.ready ? "Ingredients accounted for" : "Check ingredients"}
                      </span>
                    </div>

                    <div className="mt-4">
                      <p className="text-sm font-semibold">Ingredient quantities</p>
                      <ul className="mt-2 space-y-2 text-sm text-slate-700">
                        {recipe.ingredients.map((ingredient, index) => (
                          <li key={`${ingredient.name}-${index}`} className="rounded-lg bg-slate-50 p-3">
                            <div className="flex items-start gap-2">
                              {ingredient.inSelectedPantry ? (
                                <PackageCheck size={16} className="mt-0.5 shrink-0 text-emerald-700" />
                              ) : (
                                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-700" />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold">{ingredient.name}</p>
                                {ingredient.inSelectedPantry ? (
                                  <>
                                    <p className="mt-1 text-xs text-slate-600">
                                      Pantry product: {ingredient.pantryProductName}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-600">
                                      Use: {formatAmount(ingredient.quantityUsed, ingredient.quantityUnit)}
                                      {" · "}Available: {formatAmount(ingredient.availableQuantity, ingredient.availableUnit)}
                                    </p>
                                    {ingredient.quantityRemaining !== null && (
                                      <p className="mt-1 text-xs font-medium text-emerald-800">
                                        Remaining after complete plan: {formatAmount(ingredient.quantityRemaining, ingredient.remainingUnit)}
                                      </p>
                                    )}
                                  </>
                                ) : (
                                  <p className="mt-1 text-xs text-amber-800">
                                    Not confirmed in selected pantry. {ingredient.quantityUsed !== null ? `Suggested amount: ${formatAmount(ingredient.quantityUsed, ingredient.quantityUnit)}.` : ""}
                                  </p>
                                )}
                                {ingredient.validationNote && (
                                  <p className="mt-1 text-xs text-red-700">{ingredient.validationNote}</p>
                                )}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {recipe.validationWarnings?.length > 0 && (
                      <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                        Some quantities could not be verified. Review these amounts before cooking.
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={() => setActiveRecipeId(expanded ? "" : recipe.id)}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white"
                    >
                      <CookingPot size={16} />
                      {expanded ? "Hide preparation" : "View full cooking instructions"}
                    </button>

                    {expanded && (
                      <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                        <h5 className="font-bold">Step-by-step preparation</h5>
                        {recipe.steps?.length ? (
                          <ol className="space-y-4">
                            {recipe.steps.map((step, index) => (
                              <li key={`${recipe.id}-step-${index}`} className="flex gap-3">
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-sm font-bold text-emerald-800">
                                  {index + 1}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="font-semibold text-slate-900">{step.title}</p>
                                  <p className="mt-1 text-sm leading-6 text-slate-600">{step.instruction}</p>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {step.durationMinutes !== null && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                                        <Clock3 size={12} /> {step.durationMinutes} min
                                      </span>
                                    )}
                                    {step.heat && (
                                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                                        Heat: {step.heat}
                                      </span>
                                    )}
                                  </div>
                                  {step.doneWhen && (
                                    <p className="mt-2 flex gap-1 text-xs leading-5 text-emerald-800">
                                      <CircleCheck size={14} className="mt-0.5 shrink-0" />
                                      <span><strong>Done when:</strong> {step.doneWhen}</span>
                                    </p>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <p className="text-sm text-slate-600">No detailed preparation steps were returned. Generate the meal ideas again.</p>
                        )}

                        {recipe.tips?.length > 0 && (
                          <div className="rounded-xl bg-amber-50 p-3">
                            <h6 className="text-sm font-bold text-amber-950">Cooking tips</h6>
                            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-5 text-amber-900">
                              {recipe.tips.map((tip, index) => <li key={index}>{tip}</li>)}
                            </ul>
                          </div>
                        )}
                        {recipe.servingSuggestion && (
                          <p className="text-sm leading-5 text-slate-600">
                            <strong>Serving suggestion:</strong> {recipe.servingSuggestion}
                          </p>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          {stockSummary.length > 0 && (
            <div className="rounded-2xl border border-slate-200 p-4">
              <h3 className="flex items-center gap-2 font-extrabold">
                <PackageCheck size={19} className="text-leaf" />
                Inventory usage summary
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Totals across the generated plan. The server calculates these from validated recipe amounts.
              </p>
              <div className="mt-3 space-y-2">
                {stockSummary.map((item) => (
                  <div key={item.productName} className="rounded-lg bg-slate-50 p-3">
                    <p className="font-semibold text-sm">{item.productName}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      Available: {formatAmount(item.availableQuantity, item.unit)}
                      {" · "}Planned use: {formatAmount(item.usedQuantity, item.unit)}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-emerald-800">
                      Remaining: {formatAmount(item.remainingQuantity, item.unit)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {unusedItems.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <h3 className="font-extrabold text-amber-950">Selected items not used</h3>
              <p className="mt-1 text-xs leading-5 text-amber-900">
                These items were not forced into an unsuitable dish.
              </p>
              <div className="mt-3 space-y-2">
                {unusedItems.map((item) => (
                  <div key={item.productName} className="rounded-lg bg-white/70 p-3">
                    <p className="text-sm font-semibold text-amber-950">
                      {item.productName} — {formatAmount(item.quantityRemaining, item.unit)} remaining
                    </p>
                    <p className="mt-1 text-xs leading-5 text-amber-900">{item.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
