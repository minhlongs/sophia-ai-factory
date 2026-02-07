import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createMiddleware from 'next-intl/middleware';

const intlMiddleware = createMiddleware({
  // A list of all locales that are supported
  locales: ['en', 'vi'],

  // Used when no locale matches
  defaultLocale: 'en',

  // If true, /en/about and /about are both valid (and /about renders default locale)
  // If false, /about redirects to /en/about
  localePrefix: 'as-needed'
});

export function middleware(request: NextRequest) {
  const isConfigured = process.env.NEXT_PUBLIC_IS_CONFIGURED === "true" || process.env.IS_CONFIGURED === "true";
  const { pathname } = request.nextUrl;

  // 1. Setup Wizard Redirection Logic
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

  // 2. Admin Logic (Basic Auth)
  if (pathname.startsWith("/admin") || pathname.includes("/admin/")) {
    // Skip if it's an API route for auth check rewrite
    if (pathname === "/api/auth") return NextResponse.next();

    const basicAuth = request.headers.get("authorization");
    const url = request.nextUrl.clone(); // Clone to avoid mutation issues if any

    if (basicAuth) {
      const authValue = basicAuth.split(" ")[1];
      const [user, pwd] = atob(authValue).split(":");

      const validUser = process.env.ADMIN_USER || "admin";
      const validPass = process.env.ADMIN_PASS || "sophia2024";

      if (user === validUser && pwd === validPass) {
        // If authorized, let next-intl handle it if it's a localized admin path,
        // OR if admin is outside [locale], just return next().
        // For now, let's assume admin pages might be localized later or are fine as is.
        // If admin is NOT under [locale], intlMiddleware won't match it if we exclude it from config.matcher
        // But if we want i18n in admin, we should run intlMiddleware.

        // However, admin paths in this app seem to be at /app/(admin)/admin.
        // If we move them to [locale], they become /[locale]/admin.
        // For now, let's assume we want to apply intl middleware to everything except api/static.
        return intlMiddleware(request);
      }
    }

    url.pathname = "/api/auth";
    return NextResponse.rewrite(url);
  }

  // 3. API Routes and Setup Wizard - Skip intl middleware
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/setup-wizard") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico")
  ) {
    return NextResponse.next();
  }

  // 4. Run next-intl middleware for everything else
  return intlMiddleware(request);
}

export const config = {
  // Match all pathnames except for:
  // - /api, /_next, /_vercel
  // - /setup-wizard (handled manually above but good to exclude from matcher if we wanted purely intl)
  // - files with extensions (e.g. favicon.ico)
  matcher: ['/((?!api|_next|_vercel|setup-wizard|.*\\..*).*)']
};

