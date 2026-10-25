import { redirect } from "next/navigation";
import { getAuthenticatedProfile, ROLE_HOME } from "@/lib/auth/roles";
import Link from "next/link";
import Brand from "@/components/brand";

export const dynamic = "force-dynamic";

export default async function DashboardRouter() {
  try {
    const { profile } = await getAuthenticatedProfile();
    redirect(ROLE_HOME[profile.account_type] || "/household/dashboard");
  } catch (error) {
    if (error?.digest?.startsWith("NEXT_REDIRECT")) throw error;
    return <main className="grid min-h-screen place-items-center px-5"><div className="max-w-xl rounded-3xl bg-white p-8 shadow-soft"><Brand/><h1 className="mt-6 text-2xl font-extrabold">Connect Supabase to continue</h1><p className="mt-3 leading-7 text-slate-600">Configure your Supabase environment variables and run <code>supabase/schema.sql</code>.</p><Link href="/" className="mt-5 inline-block font-bold text-leaf">Back to home</Link></div></main>;
  }
}
