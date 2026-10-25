import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const ROLE_HOME = {
  household: "/household/dashboard",
  retailer: "/retailer/dashboard",
  organization: "/organization/dashboard",
  admin: "/admin/dashboard",
};

export async function getAuthenticatedProfile() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,full_name,account_type,is_verified")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || !profile) redirect("/login?error=profile");
  return { supabase, user, profile };
}

export async function requireRole(allowedRoles) {
  const context = await getAuthenticatedProfile();
  if (!allowedRoles.includes(context.profile.account_type)) {
    redirect(ROLE_HOME[context.profile.account_type] || "/dashboard");
  }
  return context;
}
