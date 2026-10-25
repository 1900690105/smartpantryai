import { NextResponse } from "next/server";

const BARCODE_RE = /^[0-9]{8,14}$/;

export async function GET(_request, { params }) {
  const { barcode } = await params;
  if (!BARCODE_RE.test(barcode || "")) {
    return NextResponse.json({ error: "Barcode must contain 8–14 digits." }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,brands,ingredients_text,nutriments,categories,quantity,code,allergens_tags,nutrition_grades`,
      { signal: controller.signal, headers: { "User-Agent": "SmartPantryAI/1.0 (hackathon prototype)" }, next: { revalidate: 3600 } }
    );
    if (!response.ok) throw new Error("Product source unavailable.");
    const data = await response.json();
    if (data.status !== 1 || !data.product) {
      return NextResponse.json({ error: "No product record found. You can add it manually." }, { status: 404 });
    }
    const product = data.product;
    const name = String(product.product_name || "").trim().slice(0, 120);
    if (!name) return NextResponse.json({ error: "This record has no product name. Add it manually." }, { status: 404 });
    return NextResponse.json({
      product: {
        name,
        brand: String(product.brands || "").slice(0, 120),
        quantity: String(product.quantity || "").slice(0, 80),
        ingredients: String(product.ingredients_text || "").slice(0, 2000),
        categories: String(product.categories || "").slice(0, 300),
        category: String(product.categories || "other").toLowerCase().includes("vegetable") ? "vegetable" : String(product.categories || "other").toLowerCase().includes("fruit") ? "fruit" : String(product.categories || "other").toLowerCase().includes("dairy") ? "dairy" : "other",
        nutrition_notes: [product.ingredients_text ? `Ingredients: ${product.ingredients_text}` : "", product.nutriments ? `Nutrition data available from Open Food Facts; check individual nutrient fields on the package.` : "", product.allergens_tags?.length ? `Allergens: ${product.allergens_tags.join(", ")}` : ""].filter(Boolean).join(". ").slice(0, 2000),
        nutriments: product.nutriments || {},
        nutrition_grade: String(product.nutrition_grades || "").slice(0, 10),
        allergens: Array.isArray(product.allergens_tags) ? product.allergens_tags.slice(0, 40) : [],
        barcode,
        source: "Open Food Facts",
        note: "Product details retrieved from Open Food Facts. Check the package label; nutrition and allergen data may be incomplete."
      }
    }, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
  } catch (error) {
    const timeouted = error?.name === "AbortError";
    return NextResponse.json({ error: timeouted ? "Product lookup timed out. Add the product manually." : "Product lookup is temporarily unavailable." }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
