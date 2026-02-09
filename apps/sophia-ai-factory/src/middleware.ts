import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";

const intlMiddleware = createMiddleware({
  locales: ["en", "vi"],
  defaultLocale: "en",
  localePrefix: "as-needed",
});

/**
 * Helper: check if the pathname (after stripping locale prefix) matches a given prefix.
 */
function pathnameWithoutLocale(pathname: string): string {
  const localePattern = /^\/(en|vi)(\/|$)/;
  return pathname.replace(localePattern, "/");
}

/**
 * Helper: validate admin Basic Auth credentials from request headers.
 */
function isAdminAuthorized(request: NextRequest): boolean {
  const basicAuth = request.headers.get("authorization");
  if (!basicAuth) return false;

  try {
    const authValue = basicAuth.split(" ")[1];
    const [user, pwd] = atob(authValue).split(":");
    const validUser = process.env.ADMIN_USER || "admin";
    const validPass = process.env.ADMIN_PASS || "sophia2024";
    return user === validUser && pwd === validPass;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const isConfigured =
    process.env.NEXT_PUBLIC_IS_CONFIGURED === "true" ||
    process.env.IS_CONFIGURED === "true";
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
  } else if (pathname.startsWith("/setup-wizard")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // 2. Admin Logic (Basic Auth)
  if (pathname.startsWith("/admin") || pathname.includes("/admin/")) {
    if (pathname === "/api/auth") return NextResponse.next();

    if (isAdminAuthorized(request)) {
      return intlMiddleware(request);
    }

    const url = request.nextUrl.clone();
    url.pathname = "/api/auth";
    return NextResponse.rewrite(url);
  }

  // 3. Dashboard Auth Check (Supabase Magic Link)
  const cleanPath = pathnameWithoutLocale(pathname);
  if (cleanPath.startsWith("/dashboard")) {
    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const locale = pathname.match(/^\/(en|vi)\//)?.[1] || "en";
      const loginUrl = new URL(`/${locale}/login`, request.url);
      return NextResponse.redirect(loginUrl);
    }

    // User is authenticated; apply intl middleware on the response
    const intlResponse = intlMiddleware(request);

    // Merge Supabase cookies into the intl response
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      intlResponse.cookies.set(cookie.name, cookie.value);
    });

    return intlResponse;
  }

  // 4. Auth callback - skip intl middleware
  if (pathname.startsWith("/auth/callback")) {
    return NextResponse.next();
  }

  // 5. API Routes and Setup Wizard - Skip intl middleware
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/setup-wizard") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico")
  ) {
    return NextResponse.next();
  }

  // 6. Run next-intl middleware for everything else
  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|setup-wizard|auth/callback|.*\\..*).*)"],
};
