import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Please log in first." },
        { status: 401 },
      );
    }

    const { inventoryId } = await request.json();

    if (
      typeof inventoryId !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(inventoryId)
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid inventory item." },
        { status: 400 },
      );
    }

    const { data, error } = await supabase.rpc("offer_donation", {
      p_inventory_id: inventoryId,
    });

    if (error) {
      console.error("Donation RPC error:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 },
      );
    }

    // Handle either an object or an array response.
    const result = Array.isArray(data) ? data[0] : data;

    if (result?.success === true) {
      return NextResponse.json(result);
    }

    // If the function returned no result, verify whether it actually
    // changed the inventory record before deciding whether it succeeded.
    const { data: inventory, error: inventoryError } = await supabase
      .from("inventory_batches")
      .select("id, donation_status")
      .eq("id", inventoryId)
      .maybeSingle();

    if (inventoryError) {
      console.error("Inventory verification failed:", inventoryError);
      return NextResponse.json(
        { success: false, error: "Could not verify donation status." },
        { status: 500 },
      );
    }

    if (inventory?.donation_status === "available") {
      return NextResponse.json({
        success: true,
        message: "Donation is already listed.",
        inventoryId,
      });
    }

    console.error("Unexpected donation RPC response:", data);

    return NextResponse.json(
      {
        success: false,
        error:
          "The donation function returned no result and the inventory is not marked as available. Check the database function.",
      },
      { status: 500 },
    );
  } catch (error) {
    console.error("Donation API error:", error);

    return NextResponse.json(
      { success: false, error: "Something went wrong." },
      { status: 500 },
    );
  }
}
