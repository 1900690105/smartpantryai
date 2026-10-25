import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request, { params }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id || "")) return NextResponse.json({ error: "Invalid product ID." }, { status: 400 });
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("pantry_products").select("id,name,category,price,unit,nutrition_notes,source_type,created_at").eq("id", id).eq("active", true).maybeSingle();
    if (error || !data) return NextResponse.json({ error: "Product not found or not available." }, { status: 404 });
    return NextResponse.json({ product: data }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" } });
  } catch {
    return NextResponse.json({ error: "Product service unavailable. Check database configuration." }, { status: 503 });
  }
}
