"use client";

import { useMemo, useState } from "react";
import {
  CalendarClock,
  ChefHat,
  Clock3,
  CookingPot,
  Sparkles,
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

export default function MealPlanner({ inventory = [] }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [prioritizeExpiry, setPrioritizeExpiry] = useState(true);
  const [recipes, setRecipes] = useState([]);
  const [activeRecipeId, setActiveRecipeId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const availableItems = useMemo(
    () => inventory.filter((item) => Number(item.quantity) > 0),
    [inventory],
  );

  const selectedItems = availableItems.filter((item) =>
    selectedIds.includes(item.id),
  );

  const hasExpiredSelection = selectedItems.some((item) => {
    const days = daysUntil(item.expiry_date);
    return days !== null && days < 0;
  });

  const soonCount = selectedItems.filter((item) => {
    const days = daysUntil(item.expiry_date);
    return days !== null && days >= 0 && days <= 3;
  }).length;

  function toggleItem(id, checked) {
    setSelectedIds((current) =>
      checked
        ? [...current, id]
        : current.filter((selectedId) => selectedId !== id),
    );

    setRecipes([]);
    setActiveRecipeId("");
    setError("");
    setNotice("");
  }

  async function generateMeals() {
    if (!selectedIds.length) {
      setError("Please select at least one pantry item.");
      return;
    }

    if (hasExpiredSelection) {
      setError(
        "Deselect items with a past recorded expiry date before generating meal ideas.",
      );
      return;
    }

    setGenerating(true);
    setError("");
    setNotice("");
    setRecipes([]);
    setActiveRecipeId("");

    try {
      const response = await fetch("/api/meal-planner", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          selectedIds,
          prioritizeExpiry,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not generate meal suggestions.");
      }

      setRecipes(Array.isArray(data.recipes) ? data.recipes : []);

      if (!data.recipes?.length) {
        setNotice(
          data.message ||
            "No approved recipe matched your selection. Try selecting ingredients commonly used together.",
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
          <h3 className="text-base font-extrabold">Gemini meal planner</h3>
        </div>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          Choose the ingredients you want to cook with. Gemini will suggest
          familiar recipes from our approved recipe catalogue and provide
          preparation steps. Your pantry items will not be selected
          automatically.
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
                setRecipes([]);
                setNotice("");
              }}
              className="mt-1 accent-emerald-700"
            />

            <span>
              <span className="block text-sm font-bold text-amber-950">
                Prioritize items expiring soon
              </span>
              <span className="mt-1 block text-xs leading-5 text-amber-900">
                Selected items with an upcoming expiry date will influence
                recipe ranking. Nothing is selected automatically.
              </span>
            </span>
          </label>

          <div className="space-y-2">
            <div>
              <h3 className="font-bold">Choose your ingredients</h3>
              <p className="mt-1 text-xs text-slate-500">
                Select only the products you want to use. Unselected products
                will not be sent as ingredients for this request.
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
                    onChange={(event) =>
                      toggleItem(item.id, event.target.checked)
                    }
                    className="mt-1 accent-emerald-700"
                  />

                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-slate-900">
                      {item.product_name}
                    </span>

                    <span className="mt-1 block text-xs text-slate-500">
                      Quantity: {item.quantity} {item.unit || ""}
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
                        {days === 0
                          ? "Recorded expiry is today"
                          : `Recorded expiry in ${days} day${days === 1 ? "" : "s"}`}
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>

          <div className="rounded-xl bg-cream p-3">
            <p className="text-sm font-semibold">
              {selectedItems.length} selected item
              {selectedItems.length === 1 ? "" : "s"}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {soonCount} selected item{soonCount === 1 ? "" : "s"} have a
              recorded expiry date within three days.
            </p>
          </div>

          {hasExpiredSelection && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 p-3 text-sm leading-5 text-red-800"
            >
              One or more selected items have a past recorded expiry date.
              Deselect them before generating meals. A date alone cannot
              establish whether food is safe to eat.
            </p>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 p-3 text-sm leading-5 text-red-800"
            >
              {error}
            </p>
          )}

          {notice && (
            <p
              role="status"
              className="rounded-xl bg-cream p-3 text-sm leading-5 text-slate-700"
            >
              {notice}
            </p>
          )}

          <button
            type="button"
            onClick={generateMeals}
            disabled={
              generating || selectedItems.length === 0 || hasExpiredSelection
            }
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChefHat size={18} />
            {generating ? "Generating meal ideas…" : "Generate meal ideas"}
          </button>

          {generating && (
            <p className="text-center text-xs text-slate-500">
              Gemini is choosing from approved recipes and preparing cooking
              instructions…
            </p>
          )}

          {recipes.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ChefHat size={21} className="text-leaf" />
                <h3 className="font-extrabold">Your meal suggestions</h3>
              </div>

              <p className="text-xs leading-5 text-slate-500">
                Recipes come from the approved catalogue. Gemini generates the
                preparation instructions, but does not create new dish names or
                change the ingredient matching.
              </p>

              {recipes.map((recipe) => {
                const expanded = activeRecipeId === recipe.id;

                return (
                  <article
                    key={recipe.id}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="font-bold">{recipe.name}</h4>

                        <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                          <Clock3 size={13} />
                          About {recipe.time} minutes
                        </p>
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold ${
                          recipe.ready
                            ? "bg-emerald-50 text-emerald-800"
                            : "bg-amber-50 text-amber-900"
                        }`}
                      >
                        {recipe.ready
                          ? "Core ingredients selected"
                          : "More ingredients needed"}
                      </span>
                    </div>

                    <div className="mt-3">
                      <p className="text-sm font-semibold">
                        Ingredients selected from your pantry
                      </p>

                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                        {recipe.selectedMatches.map((match, index) => (
                          <li key={`${match.productName}-${index}`}>
                            {match.productName} — {match.quantity}{" "}
                            {match.unit || ""}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {recipe.missingRequired.length > 0 && (
                      <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                        <strong>You'll also need:</strong>{" "}
                        {recipe.missingRequired.join(", ")}
                      </p>
                    )}

                    <div className="mt-3">
                      <p className="text-sm font-semibold">
                        Recipe ingredients
                      </p>

                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                        {recipe.ingredients.map((ingredient) => {
                          const selected =
                            recipe.selectedIngredientNames.includes(
                              ingredient.name,
                            );

                          return (
                            <li key={ingredient.name}>
                              {ingredient.name}
                              {selected
                                ? " — matched to selected pantry item"
                                : ingredient.required
                                  ? " — required, not selected"
                                  : " — optional"}
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setActiveRecipeId(expanded ? "" : recipe.id)
                      }
                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white"
                    >
                      <CookingPot size={16} />
                      {expanded ? "Hide preparation" : "View preparation"}
                    </button>

                    {expanded && (
                      <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                        <h5 className="font-bold">Preparation steps</h5>

                        {recipe.steps.length ? (
                          <ol className="list-decimal space-y-4 pl-5 text-sm leading-6 text-slate-600">
                            {recipe.steps.map((step, index) => (
                              <li key={index}>
                                {typeof step === "string" ? (
                                  step
                                ) : (
                                  <div className="space-y-1">
                                    <p className="font-semibold text-slate-900">
                                      {step.title || `Step ${index + 1}`}
                                    </p>

                                    <p>
                                      {step.instruction ||
                                        "Follow the cooking instructions."}
                                    </p>

                                    {step.durationMinutes != null && (
                                      <p className="text-xs text-slate-500">
                                        Time: {step.durationMinutes} minutes
                                      </p>
                                    )}

                                    {step.heat && (
                                      <p className="text-xs text-slate-500">
                                        Heat: {step.heat}
                                      </p>
                                    )}

                                    {step.doneWhen && (
                                      <p className="text-xs text-emerald-700">
                                        <strong>Done when:</strong>{" "}
                                        {step.doneWhen}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <p className="text-sm text-slate-600">
                            No preparation steps were returned. Please try
                            generating the meal ideas again.
                          </p>
                        )}

                        <p className="text-xs leading-5 text-slate-500">
                          Check ingredient labels, dietary requirements, and
                          safe cooking practices. Recipe times are estimates.
                        </p>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
