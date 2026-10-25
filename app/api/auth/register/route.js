import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendVerificationEmail } from "@/lib/mailer";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const { name, email, password, role } = await request.json();

    const cleanName = String(name || "").trim();
    const cleanEmail = String(email || "")
      .trim()
      .toLowerCase();
    const allowedRoles = ["household", "retailer", "organization"];

    if (!cleanName || cleanName.length > 80) {
      return NextResponse.json(
        { error: "Enter a valid name." },
        { status: 400 },
      );
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) ||
      cleanEmail.length > 254
    ) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 },
      );
    }

    if (
      typeof password !== "string" ||
      password.length < 8 ||
      password.length > 72
    ) {
      return NextResponse.json(
        { error: "Password must be between 8 and 72 characters." },
        { status: 400 },
      );
    }

    if (!allowedRoles.includes(role)) {
      return NextResponse.json(
        { error: "Choose a valid account type." },
        { status: 400 },
      );
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const { data, error } = await admin.auth.admin.generateLink({
      type: "signup",
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: cleanName,
          account_type: role,
        },
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      },
    });

    if (error) {
      console.error("Signup link generation failed:", error.message);
      return NextResponse.json(
        { error: "Unable to start signup. Please wait and try again." },
        { status: 400 },
      );
    }

    const actionLink = data.properties?.action_link;

    if (!actionLink) {
      throw new Error("Supabase did not return a signup link.");
    }

    await sendVerificationEmail({
      to: cleanEmail,
      verificationUrl: actionLink,
    });

    return NextResponse.json({
      success: true,
      message: "Check your email for the verification link.",
    });
  } catch (error) {
    console.error("Registration error:", error.message);

    return NextResponse.json(
      { error: "Unable to create account right now. Please try again later." },
      { status: 500 },
    );
  }
}
