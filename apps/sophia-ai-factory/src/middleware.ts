import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { getAuth } from "./lib/better-auth-server";
import { applyCorsHeaders, handleCorsPrelight } from "./lib/security/cors-security-configuration";
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from "./lib/security/rate-limiting-middleware";
import { raasGate, shouldApplyRaasGate } from "./lib/raas-gate";
import { emitUsageEvent } from "./lib/usage-metering";
import { logger } from "./lib/utils/logger-utility";
import { tenantIsolationMiddleware } from "./middleware/tenant-isolation";
import { track } from "./lib/signals/track";
import { D1Events } from "./lib/signals/d1-event-types";

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

  // Apply multi-tenant isolation for API routes
  if (pathname.startsWith('/api')) {
    const isolationResult = await tenantIsolationMiddleware(request);
    if (isolationResult) {
      return isolationResult; // Return early if isolation validation failed
    }

    // RED-TEAM #7: Webhook version pinning — force webhook senders to stable version during canary.
    // /api/webhooks/* without Cloudflare-Workers-Version-Key: stable → 503 (senders auto-retry).
    // NOWPayments + PayOS confirmed to retry on 5xx. Telegram uses long-poll (unaffected).
    if (
      pathname.startsWith('/api/webhooks/nowpayments') ||
      pathname.startsWith('/api/webhooks/payos') ||
      pathname.startsWith('/api/webhooks/telegram')
    ) {
      const versionKey = request.headers.get('Cloudflare-Workers-Version-Key');
      if (versionKey !== 'stable') {
        return new Response(
          JSON.stringify({ error: 'canary_window', message: 'Webhook pinned to stable version — retry shortly' }),
          {
            status: 503,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': '30',
            },
          }
        );
      }
    }

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

      track(D1Events.API_RATE_LIMIT_HIT, identifier, { path: pathname, identifier, limit_type: rateLimitConfig === RATE_LIMITS.auth ? 'auth' : rateLimitConfig === RATE_LIMITS.webhook ? 'webhook' : 'api' });
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

    // RaaS License Gate - Apply after rate limiting and isolation
    if (shouldApplyRaasGate(pathname)) {
      const raasResult = await raasGate(request);
      if (!raasResult.valid && raasResult.response) {
        const responseTimeMs = Date.now() - startTime;
        const forbiddenResponse = raasResult.response;
        forbiddenResponse.headers.set('X-Response-Time-Ms', String(responseTimeMs));

        // Add X-RateLimit headers for quota exceeded (429)
        if (raasResult.quotaExceeded) {
          // Quota exceeded - set remaining to 0
          forbiddenResponse.headers.set('X-RateLimit-Remaining', '0');
          // Set Retry-After if not already set
          if (!forbiddenResponse.headers.has('Retry-After')) {
            const resetTimestamp = Math.floor(Date.now() / 1000) + 3600; // Reset in 1 hour
            forbiddenResponse.headers.set('Retry-After', String(resetTimestamp - Math.floor(Date.now() / 1000)));
            forbiddenResponse.headers.set('X-RateLimit-Reset', String(resetTimestamp));
          }
        }

        // Track forbidden request (403/429) for usage metering
        emitUsageEvent(request, {
          status: forbiddenResponse.status,
          headers: forbiddenResponse.headers,
        }, {
          licenseNonce: undefined,
          tier: 'BASIC',
        }).catch(err => {
          logger.error('[Proxy] Failed to emit forbidden usage event', err);
        });

        return forbiddenResponse;
      }

      // Store RaaS context for later usage tracking
      if (raasResult.valid && raasResult.tier) {
        // Context will be used by response tracking below
        request.headers.set('x-raas-tier', raasResult.tier);
      }

      // Attach compliance receipt header if available
      if (raasResult.valid && raasResult.receipt) {
        request.headers.set('x-raas-receipt', raasResult.receipt);
      }

      // Store quota remaining for X-RateLimit headers on successful requests
      if (raasResult.valid && raasResult.quotaRemaining) {
        request.headers.set('x-quota-remaining', JSON.stringify(raasResult.quotaRemaining));
      }
    }
  }

  const isConfigured =
    process.env.NEXT_PUBLIC_IS_CONFIGURED === "true" ||
    process.env.IS_CONFIGURED === "true";

  // 1. Setup Wizard Redirection Logic — only redirect dashboard/admin, not public pages
  if (!isConfigured) {
    const cleanedForSetup = pathnameWithoutLocale(pathname);
    if (cleanedForSetup.startsWith("/dashboard") || cleanedForSetup.startsWith("/admin")) {
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

  // 3. Dashboard Auth Check (Better Auth session cookie)
  const cleanPath = pathnameWithoutLocale(pathname);
  if (cleanPath.startsWith("/dashboard")) {
    try {
      const auth = getAuth();
      const session = await auth.api.getSession({
        headers: request.headers,
      });
      if (!session) {
        return NextResponse.redirect(new URL("/login", request.url));
      }
    } catch {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // User is authenticated — apply intl middleware
    return intlMiddleware(request);
  }

  // 4. Auth callback - skip intl middleware
  if (pathname.startsWith("/auth/callback")) {
    return NextResponse.next();
  }

  // 5. API Routes and Setup Wizard - Skip intl middleware
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/setup-wizard")
  ) {
    const response = NextResponse.next();
    const responseTimeMs = Date.now() - startTime;
    response.headers.set('X-Response-Time-Ms', String(responseTimeMs));

    // Attach compliance receipt header if available from RaaS gate
    const receiptHeader = request.headers.get('x-raas-receipt');
    if (receiptHeader) {
      response.headers.set('X-RaaS-Receipt', receiptHeader);
    }

    // Add X-RateLimit headers from quota remaining
    const quotaRemainingJson = request.headers.get('x-quota-remaining');
    if (quotaRemainingJson) {
      try {
        const remaining = JSON.parse(quotaRemainingJson);
        const resetTimestamp = Math.floor(Date.now() / 1000) + 3600; // Reset in 1 hour

        response.headers.set('X-RateLimit-Limit', String(remaining.hourlyCredits || remaining.dailyCredits));
        response.headers.set('X-RateLimit-Remaining', String(remaining.hourlyCredits ?? remaining.dailyCredits));
        response.headers.set('X-RateLimit-Reset', String(resetTimestamp));
      } catch (error) {
        logger.error('[Proxy] Failed to parse quota remaining', error as Error);
      }
    }

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

// Export as both 'middleware' (Next.js 15) and 'proxy' (Next.js 16) for compatibility
export const middleware = proxy;

export const config = {
  matcher: ["/((?!api|_next|_worker|setup-wizard|auth/callback|.*\\..*).*)"],
};
