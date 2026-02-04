import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const isConfigured = process.env.NEXT_PUBLIC_IS_CONFIGURED === "true" || process.env.IS_CONFIGURED === "true";
  const { pathname } = request.nextUrl;

  // 1. Setup Wizard Redirection Logic
  // If NOT configured, and trying to access anything other than setup pages/api/static files -> Redirect to Setup
  if (!isConfigured) {
    if (
      !pathname.startsWith("/setup-wizard") &&
      !pathname.startsWith("/api/setup") &&
      !pathname.startsWith("/_next") &&
      !pathname.startsWith("/favicon.ico")
    ) {
      return NextResponse.redirect(new URL("/setup-wizard", request.url));
    }
  }
  // If ALREADY configured, block access to setup wizard
  else if (pathname.startsWith("/setup-wizard")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // 2. Admin Logic (Existing)
  if (pathname.startsWith("/admin")) {

    const basicAuth = request.headers.get("authorization");
    const url = request.nextUrl;

    if (basicAuth) {
      const authValue = basicAuth.split(" ")[1];
      const [user, pwd] = atob(authValue).split(":");

      const validUser = process.env.ADMIN_USER || "admin";
      const validPass = process.env.ADMIN_PASS || "sophia2024";

      if (user === validUser && pwd === validPass) {
        return NextResponse.next();
      }
    }

    url.pathname = "/api/auth";

    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/admin/:path*",
};
