import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Allow public pages to render setup guidance when environment variables are not configured.
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const isProtected = ["/dashboard", "/household/dashboard", "/retailer/dashboard", "/organization/dashboard", "/admin/dashboard"].some((path) => request.nextUrl.pathname.startsWith(path));
  const isAuthPage = request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/signup";

  if (isProtected && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }
  if (isAuthPage && user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    return NextResponse.redirect(redirectUrl);
  }
  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/household/dashboard/:path*", "/retailer/dashboard/:path*", "/organization/dashboard/:path*", "/admin/dashboard/:path*", "/login", "/signup"],
};
