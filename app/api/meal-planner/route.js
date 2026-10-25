import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function daysUntil(dateString) {
  if (!dateString) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(expiry.getTime())) return null;
  return Math.round((expiry.getTime() - today.getTime()) / 86400000);
}

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanString(value, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function parseGeminiJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw new Error("Gemini returned invalid JSON.");
  }
}

// Convert only known compatible units. Unknown/package units must match.
function unitInfo(unit) {
  const u = normalize(unit).replace(/\s/g, "");
  const groups = {
    mass: {
      g: 1, gram: 1, grams: 1, gm: 1, gms: 1,
      kg: 1000, kilogram: 1000, kilograms: 1000, kilo: 1000,
      mg: 0.001, milligram: 0.001, milligrams: 0.001,
    },
    volume: {
      ml: 1, milliliter: 1, milliliters: 1, millilitre: 1, millilitres: 1,
      l: 1000, liter: 1000, liters: 1000, litre: 1000, litres: 1000,
    },
    count: {
      piece: 1, pieces: 1, pc: 1, pcs: 1, item: 1, items: 1,
      egg: 1, eggs: 1, potato: 1, potatoes: 1, tomato: 1, tomatoes: 1,
      onion: 1, onions: 1, packet: 1, packets: 1, pack: 1, packs: 1,
      bottle: 1, bottles: 1, can: 1, cans: 1, tin: 1, tins: 1,
      bunch: 1, bunches: 1, clove: 1, cloves: 1,
    },
  };

  for (const [kind, units] of Object.entries(groups)) {
    if (Object.prototype.hasOwnProperty.call(units, u)) {
      return { kind, factor: units[u], canonical: kind === "mass" ? "g" : kind === "volume" ? "ml" : u };
    }
  }
  return { kind: "custom", factor: 1, canonical: u };
}

function toBase(quantity, unit) {
  const info = unitInfo(unit);
  return {
    value: quantity * info.factor,
    kind: info.kind,
    canonical: info.canonical,
  };
}

function fromBase(value, unit) {
  const info = unitInfo(unit);
  return value / info.factor;
}

function unitsCompatible(a, b) {
  const x = unitInfo(a);
  const y = unitInfo(b);
  return x.kind === y.kind && (x.kind !== "custom" || x.canonical === y.canonical);
}

function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}

export async function POST(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const ids = body?.selectedIds;
    const prioritizeExpiry = body?.prioritizeExpiry === true;

    if (
      !Array.isArray(ids) ||
      ids.length < 1 ||
      ids.length > 30 ||
      ids.some((id) => typeof id !== "string" || !id.trim())
    ) {
      return NextResponse.json({ error: "Select between 1 and 30 pantry items." }, { status: 400 });
    }

    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length !== ids.length) {
      return NextResponse.json({ error: "Duplicate inventory items were selected." }, { status: 400 });
    }

    const { data: inventory, error: inventoryError } = await supabase
      .from("inventory_batches")
      .select("id,product_name,quantity,unit,expiry_date")
      .eq("user_id", user.id)
      .in("id", uniqueIds);

    if (inventoryError) {
      console.error("Inventory query failed:", inventoryError.message);
      return NextResponse.json({ error: "Could not load your pantry inventory." }, { status: 500 });
    }

    if (!inventory || inventory.length !== uniqueIds.length) {
      return NextResponse.json({ error: "Some selected items were not found in your inventory." }, { status: 400 });
    }

    if (inventory.some((item) => !item.product_name || !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0)) {
      return NextResponse.json({ error: "Selected items must have names and positive quantities." }, { status: 400 });
    }

    const expiredItems = inventory.filter((item) => {
      const days = daysUntil(item.expiry_date);
      return days !== null && days < 0;
    });
    if (expiredItems.length) {
      return NextResponse.json({
        error: "Some selected items have a past recorded expiry date. Deselect them before generating meal ideas.",
      }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    if (!apiKey) {
      return NextResponse.json({ error: "Gemini is not configured. Add GEMINI_API_KEY to your server environment." }, { status: 500 });
    }

    const pantryItems = inventory.map((item) => ({
      productName: item.product_name,
      availableQuantity: Number(item.quantity),
      unit: item.unit || "unit",
      expiryDate: item.expiry_date,
      daysUntilExpiry: daysUntil(item.expiry_date),
    }));

    const prompt = `
You are SmartPantry AI, a careful home cook and inventory-aware meal planner.
Generate up to 5 REAL, recognizable meals, snacks or desserts based on this exact selected inventory.
There is NO fixed recipe catalogue. Invent no fake or implausible dishes.

SELECTED INVENTORY:
${JSON.stringify(pantryItems)}

Prioritize ingredients expiring soon: ${prioritizeExpiry}

OBJECTIVES:
- Try to use as many selected products as reasonably possible across the whole plan.
- First consider whether selected items genuinely belong together in a familiar dish.
- If items do not belong together, suggest separate sensible dishes where possible.
- Never force unrelated items into one dish merely to use everything.
- Unused products are acceptable; list them and explain why they were not used.
- Never use more of an inventory item across all recipes than the available quantity.
- For each pantry ingredient, pantryProductName must exactly equal one selected productName.
- Do not assume a packet's weight or contents if not provided.
- Quantity values must be numeric, positive, and expressed in a unit compatible with the selected inventory item's unit.
- For a pantry ingredient, quantityUsed must not exceed availableQuantity after accounting for its use in previous recipes.
- Additional ingredients can be used only if clearly marked with pantryProductName: null.
- Use practical amounts appropriate for servings. If an item quantity/unit is ambiguous, be conservative.
- Detailed cooking steps must include what to do, approximate duration, heat level when applicable, and a clear sign of doneness.
- Avoid medical claims.

Return valid JSON only in this shape:
{
  "recipes": [
    {
      "name": "Recognizable dish name",
      "description": "Short description",
      "prepMinutes": 10,
      "cookMinutes": 20,
      "servings": 2,
      "ingredients": [
        {
          "name": "Ingredient name",
          "pantryProductName": "Exact selected productName or null",
          "quantityUsed": 200,
          "quantityUnit": "g",
          "required": true
        }
      ],
      "steps": [
        {
          "title": "Prepare ingredients",
          "instruction": "Specific, actionable cooking instruction.",
          "durationMinutes": 5,
          "heat": "No heat",
          "doneWhen": "Clear observable sign."
        }
      ],
      "tips": ["Practical tip"],
      "servingSuggestion": "How to serve"
    }
  ],
  "unusedItems": [
    {
      "productName": "Exact selected productName",
      "reason": "Why no sensible recipe uses it"
    }
  ]
}
Return JSON only. Do not include Markdown fences or text outside JSON.
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.55,
            maxOutputTokens: 6500,
          },
        }),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const details = await response.text();
      console.error("Gemini API request failed:", details);
      return NextResponse.json({ error: "Gemini could not generate meal suggestions. Please try again." }, { status: 502 });
    }

    const geminiData = await response.json();
    const generatedText = geminiData.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("");

    if (!generatedText) {
      return NextResponse.json({ error: "Gemini returned an empty response. Please try again." }, { status: 502 });
    }

    let generated;
    try {
      generated = parseGeminiJson(generatedText);
    } catch {
      console.error("Invalid Gemini JSON:", generatedText);
      return NextResponse.json({ error: "Gemini returned invalid meal data. Please try again." }, { status: 502 });
    }

    const inventoryByName = new Map(inventory.map((item) => [normalize(item.product_name), item]));
    const remainingBase = new Map();
    for (const item of inventory) {
      const base = toBase(Number(item.quantity), item.unit || "unit");
      remainingBase.set(item.id, { ...base, initial: base.value });
    }

    const usedInventoryIds = new Set();
    const seenMeals = new Set();
    const rejectedMeals = [];

    const recipes = (Array.isArray(generated.recipes) ? generated.recipes : [])
      .slice(0, 10)
      .filter((recipe) => {
        const name = cleanString(recipe?.name, 150);
        const key = normalize(name);
        if (!key || seenMeals.has(key)) return false;
        seenMeals.add(key);
        return true;
      })
      .map((recipe, index) => {
        const ingredients = [];
        const pantryUsageThisRecipe = new Map();

        for (const raw of (Array.isArray(recipe.ingredients) ? recipe.ingredients : []).slice(0, 30)) {
          const name = cleanString(raw?.name, 120);
          if (!name) continue;

          const pantryProductName = typeof raw?.pantryProductName === "string"
            ? raw.pantryProductName.trim()
            : "";
          const quantityUsed = Number(raw?.quantityUsed);
          const quantityUnit = cleanString(raw?.quantityUnit, 40) || "unit";

          if (!pantryProductName) {
            ingredients.push({
              name,
              quantityUsed: Number.isFinite(quantityUsed) && quantityUsed > 0 ? quantityUsed : null,
              quantityUnit,
              required: raw?.required !== false,
              inSelectedPantry: false,
              pantryProductName: null,
              availableQuantity: null,
              availableUnit: null,
              quantityRemaining: null,
              remainingUnit: null,
            });
            continue;
          }

          const inventoryItem = inventoryByName.get(normalize(pantryProductName));
          if (!inventoryItem) {
            // Gemini cannot make an unselected product appear in the pantry.
            ingredients.push({
              name,
              quantityUsed: Number.isFinite(quantityUsed) && quantityUsed > 0 ? quantityUsed : null,
              quantityUnit,
              required: raw?.required !== false,
              inSelectedPantry: false,
              pantryProductName: null,
              availableQuantity: null,
              availableUnit: null,
              quantityRemaining: null,
              remainingUnit: null,
              validationNote: "The product was not in the selected inventory.",
            });
            continue;
          }

          if (!Number.isFinite(quantityUsed) || quantityUsed <= 0 ||
              !unitsCompatible(inventoryItem.unit || "unit", quantityUnit)) {
            ingredients.push({
              name,
              quantityUsed: null,
              quantityUnit,
              required: raw?.required !== false,
              inSelectedPantry: true,
              pantryProductName: inventoryItem.product_name,
              availableQuantity: Number(inventoryItem.quantity),
              availableUnit: inventoryItem.unit || "unit",
              quantityRemaining: null,
              remainingUnit: inventoryItem.unit || "unit",
              validationNote: "Quantity could not be safely validated because the units were incompatible or missing.",
            });
            continue;
          }

          const available = remainingBase.get(inventoryItem.id);
          const requestedBase = toBase(quantityUsed, quantityUnit);
          const priorThisRecipe = pantryUsageThisRecipe.get(inventoryItem.id) || 0;
          const remainingNow = available.value - priorThisRecipe;

          if (requestedBase.kind !== available.kind || requestedBase.value > remainingNow + 1e-8) {
            ingredients.push({
              name,
              quantityUsed: null,
              quantityUnit,
              required: raw?.required !== false,
              inSelectedPantry: true,
              pantryProductName: inventoryItem.product_name,
              availableQuantity: Number(inventoryItem.quantity),
              availableUnit: inventoryItem.unit || "unit",
              quantityRemaining: fromBase(available.value, inventoryItem.unit || "unit"),
              remainingUnit: inventoryItem.unit || "unit",
              validationNote: "This amount exceeded the remaining available quantity or used an incompatible unit.",
            });
            continue;
          }

          pantryUsageThisRecipe.set(
            inventoryItem.id,
            priorThisRecipe + requestedBase.value
          );
          usedInventoryIds.add(inventoryItem.id);

          ingredients.push({
            name,
            quantityUsed,
            quantityUnit,
            required: raw?.required !== false,
            inSelectedPantry: true,
            pantryProductName: inventoryItem.product_name,
            availableQuantity: Number(inventoryItem.quantity),
            availableUnit: inventoryItem.unit || "unit",
            quantityRemaining: null,
            remainingUnit: inventoryItem.unit || "unit",
          });
        }

        const steps = (Array.isArray(recipe.steps) ? recipe.steps : [])
          .slice(0, 15)
          .map((step) => ({
            title: cleanString(step?.title, 120) || "Step",
            instruction: cleanString(step?.instruction, 1000),
            durationMinutes: Number.isFinite(Number(step?.durationMinutes))
              ? Math.max(0, Math.min(240, Number(step.durationMinutes)))
              : null,
            heat: cleanString(step?.heat, 80),
            doneWhen: cleanString(step?.doneWhen, 300),
          }))
          .filter((step) => step.instruction);

        const pantryMatches = ingredients.filter((item) => item.inSelectedPantry && item.quantityUsed !== null);
        const missingIngredients = ingredients.filter((item) => !item.inSelectedPantry);

        return {
          id: `gemini-meal-${index + 1}`,
          name: cleanString(recipe.name, 150),
          description: cleanString(recipe.description, 500),
          prepMinutes: Math.max(0, Math.min(240, Number(recipe.prepMinutes) || 0)),
          cookMinutes: Math.max(0, Math.min(240, Number(recipe.cookMinutes) || 0)),
          time: Math.max(1, Math.min(480, (Number(recipe.prepMinutes) || 0) + (Number(recipe.cookMinutes) || 0) || 30)),
          servings: Math.max(1, Math.min(20, Number(recipe.servings) || 2)),
          ingredients,
          selectedMatches: pantryMatches.map((item) => ({
            productName: item.pantryProductName,
            quantity: item.quantityUsed,
            unit: item.quantityUnit,
            matchedIngredient: item.name,
          })),
          selectedIngredientNames: pantryMatches.map((item) => item.name),
          missingIngredients,
          missingRequired: missingIngredients.filter((item) => item.required).map((item) => item.name),
          ready: missingIngredients.filter((item) => item.required).length === 0 &&
            ingredients.every((item) => !item.validationNote),
          soonCount: new Set(
            pantryMatches
              .filter((item) => {
                const found = inventoryByName.get(normalize(item.pantryProductName));
                const days = found ? daysUntil(found.expiry_date) : null;
                return days !== null && days >= 0 && days <= 3;
              })
              .map((item) => item.pantryProductName)
          ).size,
          steps,
          tips: Array.isArray(recipe.tips)
            ? recipe.tips.filter((tip) => typeof tip === "string").slice(0, 8).map((tip) => tip.slice(0, 300))
            : [],
          servingSuggestion: cleanString(recipe.servingSuggestion, 500),
          validationWarnings: ingredients.filter((item) => item.validationNote).map((item) => ({
            ingredient: item.name,
            message: item.validationNote,
          })),
          _usage: [...pantryUsageThisRecipe.entries()].map(([id, value]) => ({ id, value })),
        };
      })
      .filter((recipe) => recipe.name && recipe.steps.length > 0 && recipe.selectedMatches.length > 0);

    // Apply validated usage only after processing a recipe. If Gemini attempts to
    // spend the same stock in multiple recipes, the later use is rejected above
    // only if previous recipes have already been committed. Revalidate sequentially
    // below for cumulative stock safety.
    const committed = new Map();
    const finalRecipes = [];

    for (const recipe of recipes) {
      let valid = true;
      for (const usage of recipe._usage) {
        const item = inventory.find((entry) => entry.id === usage.id);
        const base = toBase(Number(item.quantity), item.unit || "unit");
        const already = committed.get(usage.id) || 0;
        if (already + usage.value > base.value + 1e-8) {
          valid = false;
          break;
        }
      }

      if (!valid) {
        rejectedMeals.push(recipe.name);
        continue;
      }

      for (const usage of recipe._usage) {
        committed.set(usage.id, (committed.get(usage.id) || 0) + usage.value);
      }
      finalRecipes.push(recipe);
    }

    const stockSummary = inventory.map((item) => {
      const base = toBase(Number(item.quantity), item.unit || "unit");
      const usedBase = committed.get(item.id) || 0;
      const remaining = Math.max(0, base.value - usedBase);
      return {
        productName: item.product_name,
        availableQuantity: Number(item.quantity),
        unit: item.unit || "unit",
        usedQuantity: fromBase(usedBase, item.unit || "unit"),
        remainingQuantity: fromBase(remaining, item.unit || "unit"),
        expiryDate: item.expiry_date,
        daysUntilExpiry: daysUntil(item.expiry_date),
        used: usedBase > 0,
      };
    });

    // Recalculate each ingredient's remaining quantity based on the total stock
    // used by all accepted recipes, rather than trusting Gemini's estimate.
    for (const recipe of finalRecipes) {
      for (const ingredient of recipe.ingredients) {
        if (!ingredient.inSelectedPantry || !ingredient.pantryProductName || ingredient.quantityUsed === null) continue;
        const stock = stockSummary.find(
          (item) => normalize(item.productName) === normalize(ingredient.pantryProductName)
        );
        if (stock) {
          ingredient.quantityRemaining = stock.remainingQuantity;
          ingredient.remainingUnit = stock.unit;
        }
      }
      delete recipe._usage;
    }

    const unusedItems = Array.isArray(generated.unusedItems)
      ? generated.unusedItems
          .filter((item) => item && typeof item.productName === "string")
          .map((item) => {
            const found = inventoryByName.get(normalize(item.productName));
            if (!found) return null;
            const stock = stockSummary.find((entry) => entry.productName === found.product_name);
            if (!stock || stock.used) return null;
            return {
              productName: found.product_name,
              quantityRemaining: stock.remainingQuantity,
              unit: stock.unit,
              reason: cleanString(item.reason, 300) || "No suitable meal used this item.",
            };
          })
          .filter(Boolean)
      : [];

    // Ensure every unused selected item is accounted for, even if Gemini omitted it.
    for (const stock of stockSummary) {
      if (!stock.used && !unusedItems.some((item) => normalize(item.productName) === normalize(stock.productName))) {
        unusedItems.push({
          productName: stock.productName,
          quantityRemaining: stock.remainingQuantity,
          unit: stock.unit,
          reason: "No generated meal used this item.",
        });
      }
    }

    return NextResponse.json({
      recipes: finalRecipes.slice(0, 5),
      stockSummary,
      unusedItems,
      message: finalRecipes.length
        ? undefined
        : "No suitable meals could be generated from these selected items. Try selecting more ingredients that work well together.",
      rejectedMeals: rejectedMeals.length ? rejectedMeals : undefined,
    });
  } catch (error) {
    console.error("Meal planner route error:", error);
    return NextResponse.json(
      { error: "Something went wrong while generating meal suggestions." },
      { status: 500 }
    );
  }
}
