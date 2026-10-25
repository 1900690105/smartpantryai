import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Please log in first." },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { inventoryId, quantity, action } = body;

    if (
      typeof inventoryId !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(inventoryId)
    ) {
      return NextResponse.json(
        { error: "Invalid inventory item." },
        { status: 400 },
      );
    }

    if (action === "mark_consumed") {
      const { data, error } = await supabase
        .from("inventory_batches")
        .update({
          is_consumed: true,
          quantity: 0,
        })
        .eq("id", inventoryId)
        .eq("user_id", user.id)
        .select("id, quantity, is_consumed")
        .maybeSingle();

      if (error) {
        console.error("Mark consumed error:", error);

        return NextResponse.json(
          { error: "Could not update inventory item." },
          { status: 500 },
        );
      }

      if (!data) {
        return NextResponse.json(
          { error: "Inventory item not found." },
          { status: 404 },
        );
      }

      return NextResponse.json({
        success: true,
        message: "Product marked as finished.",
        item: data,
      });
    }

    if (
      typeof quantity !== "number" ||
      !Number.isFinite(quantity) ||
      quantity < 0
    ) {
      return NextResponse.json(
        { error: "Enter a valid remaining quantity." },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("inventory_batches")
      .update({
        quantity,
        is_consumed: quantity === 0,
      })
      .eq("id", inventoryId)
      .eq("user_id", user.id)
      .select("id, quantity, is_consumed")
      .maybeSingle();

    if (error) {
      console.error("Quantity update error:", error);

      return NextResponse.json(
        { error: "Could not update quantity." },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Inventory item not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Remaining quantity updated successfully.",
      item: data,
      quantity: data.quantity,
    });
  } catch (error) {
    console.error("Inventory API error:", error);

    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}
