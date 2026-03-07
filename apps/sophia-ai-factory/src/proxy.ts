import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { applyCorsHeaders, handleCorsPrelight } from "./lib/security/cors-security-configuration";
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from "./lib/security/rate-limiting-middleware";
import { raasGate, shouldApplyRaasGate } from "./lib/raas-gate";
import { emitUsageEvent } from "./lib/usage-metering";
import { logger } from "./lib/utils/logger-utility";

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
    const validUser = process.env.ADMIN_USER;
    const validPass = process.env.ADMIN_PASS;
    if (!validUser || !validPass) return false;
    return user === validUser && pwd === validPass;
  } catch {
    return false;
  }
}

// Paths that should be ignored by most middleware logic (static files, internal Next.js paths)
const PUBLIC_FILE_EXTENSIONS = /\.(.*)$/;
const isInternalOrStatic = (pathname: string) =>
  pathname.startsWith("/_next") ||
  pathname.startsWith("/favicon.ico") ||
  PUBLIC_FILE_EXTENSIONS.test(pathname);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get('origin');
  const startTime = Date.now();

  if (isInternalOrStatic(pathname)) {
    return NextResponse.next();
  }

  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    return handleCorsPrelight(origin);
  }

  // Rate limiting for API routes
  if (pathname.startsWith('/api')) {
    const identifier = getClientIdentifier(request);
    let rateLimitConfig: typeof RATE_LIMITS.api | typeof RATE_LIMITS.auth | typeof RATE_LIMITS.webhook = RATE_LIMITS.api;

    // Stricter limits for auth routes
    if (pathname.startsWith('/api/auth') || pathname.startsWith('/api/admin')) {
      rateLimitConfig = RATE_LIMITS.auth;
    }
    // Higher limits for webhooks
    else if (pathname.startsWith('/api/webhooks')) {
      rateLimitConfig = RATE_LIMITS.webhook;
    }

    const rateLimitResult = await checkRateLimit(identifier, rateLimitConfig);

    if (!rateLimitResult.success) {
      const responseTimeMs = Date.now() - startTime;
      const rateLimitResponse = new NextResponse(
        JSON.stringify({
          error: 'Too many requests',
          retryAfter: rateLimitResult.reset,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(rateLimitResult.reset - Math.floor(Date.now() / 1000)),
            'X-RateLimit-Limit': String(rateLimitConfig.maxRequests),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(rateLimitResult.reset),
            'X-Response-Time-Ms': String(responseTimeMs),
          },
        }
      );

      // Track rate-limited request (429) for usage metering
      // This is important for quota enforcement analytics
      emitUsageEvent(request, {
        status: 429,
        headers: rateLimitResponse.headers,
      }).catch(err => {
        logger.error('[Proxy] Failed to emit 429 usage event', err);
      });

      return rateLimitResponse;
    }

    // RaaS License Gate - Apply after rate limiting
    if (shouldApplyRaasGate(pathname)) {
      const raasResult = await raasGate(request);
      if (!raasResult.valid && raasResult.response) {
        const responseTimeMs = Date.now() - startTime;
        const forbiddenResponse = raasResult.response;
        forbiddenResponse.headers.set('X-Response-Time-Ms', String(responseTimeMs));

        // Track forbidden request (403) for usage metering
        emitUsageEvent(request, {
          status: 403,
          headers: forbiddenResponse.headers,
        }, {
          licenseNonce: undefined,
          tier: 'BASIC',
        }).catch(err => {
          logger.error('[Proxy] Failed to emit 403 usage event', err);
        });

        return forbiddenResponse;
      }

      // Store RaaS context for later usage tracking
      if (raasResult.valid && raasResult.tier) {
        // Context will be used by response tracking below
        request.headers.set('x-raas-tier', raasResult.tier);
      }
    }
  }

  const isConfigured =
    process.env.NEXT_PUBLIC_IS_CONFIGURED === "true" ||
    process.env.IS_CONFIGURED === "true";

  // 1. Setup Wizard Redirection Logic
  if (!isConfigured) {
    if (
      !pathname.startsWith("/setup-wizard") &&
      !pathname.startsWith("/api/setup")
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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
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

  // 4.5. Bare /login redirect — send to locale-prefixed login
  if (pathname === "/login") {
    const locale = request.cookies.get("NEXT_LOCALE")?.value || "en";
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
  }

  // 5. API Routes and Setup Wizard - Skip intl middleware
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/setup-wizard")
  ) {
    const response = NextResponse.next();
    const responseTimeMs = Date.now() - startTime;
    response.headers.set('X-Response-Time-Ms', String(responseTimeMs));

    // Track successful API request for usage metering
    // Extract RaaS context if available
    const raasTier = request.headers.get('x-raas-tier');
    emitUsageEvent(request, {
      status: response.status,
      headers: response.headers,
    }, {
      tier: raasTier || 'BASIC',
      // licenseNonce will be extracted from request headers by emitUsageEvent
    }).catch(err => {
      logger.error('[Proxy] Failed to emit success usage event', err);
    });

    return response;
  }

  // 6. Run next-intl middleware for everything else
  const response = intlMiddleware(request);

  // Apply CORS headers to all responses
  return applyCorsHeaders(response, origin);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|setup-wizard|auth/callback|.*\\..*).*)"],
};
