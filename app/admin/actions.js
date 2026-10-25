"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/roles";

export async function setAccountVerification(formData) {
  const parsed = z.object({ user_id: z.string().uuid(), verified: z.enum(["true", "false"]) }).safeParse({ user_id: formData.get("user_id"), verified: formData.get("verified") });
  if (!parsed.success) return;
  const { supabase } = await requireRole(["admin"]);
  const { error } = await supabase.rpc("admin_set_user_verification", { p_user_id: parsed.data.user_id, p_verified: parsed.data.verified === "true" });
  if (!error) revalidatePath("/admin/dashboard");
}
