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
        { error: "Please log in first." },
        { status: 401 },
      );
    }

    const { inventoryId } = await request.json();

    if (!inventoryId || typeof inventoryId !== "string") {
      return NextResponse.json(
        { error: "Invalid inventory item." },
        { status: 400 },
      );
    }

    const { data, error } = await supabase.rpc("offer_donation", {
      p_inventory_id: inventoryId,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message || "Could not process donation." },
        { status: 400 },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Donation API error:", error);

    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 },
    );
  }
}

// import { NextResponse } from "next/server";
// import { createClient } from "@/lib/supabase/server";

// export async function POST(request) {
//   try {
//     const supabase = await createClient();

//     const {
//       data: { user },
//       error: authError,
//     } = await supabase.auth.getUser();

//     if (authError || !user) {
//       return NextResponse.json(
//         { error: "Please log in to offer food for donation." },
//         { status: 401 },
//       );
//     }

//     const { inventoryId } = await request.json();

//     if (!inventoryId || typeof inventoryId !== "string") {
//       return NextResponse.json(
//         { error: "A valid inventory item is required." },
//         { status: 400 },
//       );
//     }

//     const { data, error } = await supabase
//       .from("inventory_batches")
//       .update({ donation_status: "available" })
//       .eq("id", inventoryId)
//       .eq("user_id", user.id)
//       .eq("donation_status", "not_donated")
//       .gt("quantity", 0)
//       .select("id, product_name, quantity, unit, donation_status")
//       .maybeSingle();

//     if (error) {
//       console.error("Donation update failed:", error);
//       return NextResponse.json(
//         { error: "Could not update the donation status." },
//         { status: 500 },
//       );
//     }

//     if (!data) {
//       return NextResponse.json(
//         {
//           error:
//             "Item not found, already offered for donation, or no longer available.",
//         },
//         { status: 409 },
//       );
//     }

//     return NextResponse.json({
//       message: "Item is now available for donation.",
//       item: data,
//     });
//   } catch (error) {
//     console.error("Donation API error:", error);
//     return NextResponse.json(
//       { error: "Something went wrong while offering this item." },
//       { status: 500 },
//     );
//   }
// }
