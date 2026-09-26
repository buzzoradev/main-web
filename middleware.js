import { NextResponse } from "next/server";

/**
 * Lightweight Route Protection Middleware for Buzzora Admin Routes.
 * 
 * Boundary isolation:
 * - Matcher strictly targets /admin/:path*
 * - Never runs on /api/phonepe/*, /track-order, /api/orders/*, or public storefront.
 * - Early check redirects users without an admin session cookie to /admin/login.
 * - Authoritative token verification and role checking still execute server-side in pages and route handlers.
 * - Enforces dynamic no-store cache headers on all admin navigation.
 */
export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Early route defense for /admin subpaths (excluding /admin/login)
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const token = request.cookies.get("buzzora_admin_token")?.value;

    if (!token) {
      const loginUrl = new URL("/admin/login", request.url);
      const redirectRes = NextResponse.redirect(loginUrl);
      redirectRes.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      return redirectRes;
    }
  }

  const response = NextResponse.next();

  // Enforce strict no-store headers on all admin pages
  if (pathname.startsWith("/admin")) {
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    response.headers.set("X-Frame-Options", "SAMEORIGIN");
    response.headers.set("X-Content-Type-Options", "nosniff");
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
