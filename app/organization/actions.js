"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/roles";

async function updateDonationRequest(formData, nextStatus) {
  const { supabase, user } = await requireRole(["household"]);

  const requestId = String(formData.get("request_id") || "").trim();

  if (!requestId) {
    redirect("/household/dashboard?error=missing-request");
  }

  // Only allow the donor who owns the offer to decide.
  const { data: request, error: requestError } = await supabase
    .from("donation_requests")
    .select(
      `
      id,
      status,
      donation_offer_id,
      donation_offers!inner (
        id,
        user_id
      )
    `,
    )
    .eq("id", requestId)
    .eq("donation_offers.user_id", user.id)
    .maybeSingle();

  if (requestError || !request) {
    redirect("/household/dashboard?error=request-not-found");
  }

  if (request.status !== "pending") {
    redirect("/household/dashboard?error=request-already-processed");
  }

  const { error } = await supabase
    .from("donation_requests")
    .update({ status: nextStatus })
    .eq("id", requestId)
    .eq("status", "pending");

  if (error) {
    console.error("Donation request decision failed:", error.message);
    redirect("/household/dashboard?error=update-failed");
  }

  revalidatePath("/household/dashboard");
  revalidatePath("/organization/dashboard");
  redirect(`/household/dashboard?success=${nextStatus}`);
}

export async function approveDonationRequest(formData) {
  return updateDonationRequest(formData, "approved");
}

export async function rejectDonationRequest(formData) {
  return updateDonationRequest(formData, "rejected");
}
