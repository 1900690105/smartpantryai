"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/roles";

const batchSchema = z.object({
  name: z.string().trim().min(1).max(120),
  quantity: z.coerce.number().positive().max(100000),
  unit: z.enum(["pcs", "g", "kg", "ml", "l", "pack"]),
  expiry_date: z.string().optional(),
  unit_cost: z.coerce.number().min(0).max(10000000).default(0),
  source: z.enum(["manual", "barcode"]).default("manual"),
});

export async function addInventoryBatch(formData) {
  const parsed = batchSchema.safeParse({
    name: formData.get("name"),
    quantity: formData.get("quantity"),
    unit: formData.get("unit"),
    expiry_date: formData.get("expiry_date") || undefined,
    unit_cost: formData.get("unit_cost") || 0,
    source: formData.get("source") || "manual",
  });
  if (!parsed.success)
    return { error: "Check the product name, quantity, unit and date." };
  const { supabase, user } = await requireRole(["household"]);
  const d = parsed.data;
  const { error } = await supabase.from("inventory_batches").insert({
    user_id: user.id,
    product_name: d.name,
    quantity: d.quantity,
    unit: d.unit,
    expiry_date: d.expiry_date || null,
    unit_cost: d.unit_cost,
    source: d.source,
  });
  if (error)
    return {
      error:
        "Could not save inventory. Check the database setup and try again.",
    };
  revalidatePath("/dashboard");
  revalidatePath("/household/dashboard");
  revalidatePath("/retailer/dashboard");
  return { success: true };
}

export async function recordInventoryEvent(formData) {
  const schema = z.object({
    batch_id: z.string().uuid(),
    event_type: z.enum(["consume", "waste", "sale"]),
    quantity: z.coerce.number().positive().max(100000),
    reason: z.string().trim().max(200).optional(),
  });
  const parsed = schema.safeParse({
    batch_id: formData.get("batch_id"),
    event_type: formData.get("event_type"),
    quantity: formData.get("quantity"),
    reason: formData.get("reason") || "",
  });
  if (!parsed.success) return { error: "Invalid inventory update." };
  const { supabase, user, profile } = await requireRole([
    "household",
    "retailer",
  ]);
  if (profile.account_type === "retailer" && !profile.is_verified)
    return {
      error: "Your retailer account must be verified before updating stock.",
    };
  const { data, error } = await supabase.rpc("record_inventory_event", {
    p_batch_id: parsed.data.batch_id,
    p_event_type: parsed.data.event_type,
    p_quantity: parsed.data.quantity,
    p_reason: parsed.data.reason || null,
  });
  if (error)
    return {
      error: error.message.includes("INSUFFICIENT_STOCK")
        ? "Not enough stock for that update."
        : "Could not update stock. Refresh and try again.",
    };
  revalidatePath("/dashboard");
  revalidatePath("/household/dashboard");
  revalidatePath("/retailer/dashboard");
  return { success: true, event: data };
}

export async function createDonationOffer(formData) {
  const schema = z.object({
    batch_id: z.string().uuid(),
    quantity: z.coerce.number().positive().max(100000),
    notes: z.string().trim().max(300).optional(),
  });
  const parsed = schema.safeParse({
    batch_id: formData.get("batch_id"),
    quantity: formData.get("quantity"),
    notes: formData.get("notes") || "",
  });
  if (!parsed.success) return { error: "Enter a valid donation quantity." };
  const { supabase, user, profile } = await requireRole([
    "household",
    "retailer",
  ]);
  if (profile.account_type === "retailer" && !profile.is_verified)
    return {
      error:
        "Your retailer account must be verified before offering donations.",
    };
  const { data, error } = await supabase.rpc("create_donation_offer", {
    p_batch_id: parsed.data.batch_id,
    p_quantity: parsed.data.quantity,
    p_notes: parsed.data.notes || null,
  });
  if (error)
    return {
      error: error.message.includes("INSUFFICIENT_STOCK")
        ? "Not enough stock to offer that quantity."
        : "Could not create donation offer.",
    };
  revalidatePath("/dashboard");
  revalidatePath("/household/dashboard");
  revalidatePath("/retailer/dashboard");
  return { success: true, donationId: data };
}

export async function redeemDemoReward(formData) {
  const schema = z.object({ reward_id: z.string().uuid() });
  const parsed = schema.safeParse({ reward_id: formData.get("reward_id") });
  if (!parsed.success) return { error: "Invalid reward." };
  const { supabase } = await requireRole(["household"]);
  const { error } = await supabase.rpc("redeem_reward", {
    p_reward_id: parsed.data.reward_id,
  });
  if (error)
    return {
      error: error.message.includes("INSUFFICIENT_CREDITS")
        ? "Not enough credits for this reward."
        : "Could not redeem this reward.",
    };
  revalidatePath("/dashboard");
  revalidatePath("/household/dashboard");
  revalidatePath("/retailer/dashboard");
  return { success: true };
}

export async function registerFreshProduct(formData) {
  const schema = z.object({
    name: z.string().trim().min(2).max(120),
    category: z.enum(["vegetable", "fruit", "grain", "dairy", "other"]),
    price: z.coerce.number().min(0).max(1000000).default(0),
    unit: z.enum(["pcs", "kg", "g", "pack"]).default("kg"),
    nutrition_notes: z.string().trim().max(1000).optional(),
  });
  const parsed = schema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    price: formData.get("price") || 0,
    unit: formData.get("unit") || "kg",
    nutrition_notes: formData.get("nutrition_notes") || "",
  });
  if (!parsed.success) return { error: "Check the product name and details." };
  const { supabase, user, profile } = await requireRole(["retailer"]);
  if (!profile.is_verified)
    return {
      error:
        "Your retailer account must be verified before registering products.",
    };

  const expiryDate = formData.get("expiry_date");
  const expiryType = formData.get("expiry_type") || "unknown";

  const allowedExpiryTypes = ["printed", "estimated", "unknown"];

  if (!allowedExpiryTypes.includes(expiryType)) {
    return { error: "Invalid expiry date type." };
  }

  if (expiryDate && !/^\d{4}-\d{2}-\d{2}$/.test(String(expiryDate))) {
    return { error: "Please enter a valid expiry date." };
  }

  const d = parsed.data;
  const { data, error } = await supabase
    .from("pantry_products")
    .insert({
      owner_id: user.id,
      name: d.name,
      category: d.category,
      price: d.price,
      unit: d.unit,
      nutrition_notes: d.nutrition_notes || null,
      source_type: "owner_qr",
      expiry_date: expiryDate || null,
      expiry_type: expiryType,
    })
    .select("id,name,category,price,unit,nutrition_notes,source_type")
    .single();
  if (error || !data)
    return {
      error:
        "Could not register product. Run the latest schema.sql and try again.",
    };
  revalidatePath("/dashboard");
  revalidatePath("/household/dashboard");
  revalidatePath("/retailer/dashboard");
  return { success: true, product: data };
}
