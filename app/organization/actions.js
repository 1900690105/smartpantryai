"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/roles";

export async function requestDonation(formData) {
  const parsed = z.object({ offer_id: z.string().uuid(), notes: z.string().trim().max(300).optional() }).safeParse({ offer_id: formData.get("offer_id"), notes: formData.get("notes") || "" });
  if (!parsed.success) return;
  const { supabase, user, profile } = await requireRole(["organization"]);
  if (!profile.is_verified) return;
  const { error } = await supabase.from("donation_requests").insert({ organization_id: user.id, offer_id: parsed.data.offer_id, notes: parsed.data.notes || null });
  if (error) return;
  revalidatePath("/organization/dashboard");
}
