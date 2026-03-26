import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { logger } from "@/lib/logger";

// --- Rate limiting (in-memory, sliding window) ---
// Limits /api/auth/* to 10 requests per IP per 60 seconds
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

// Public routes that don't require authentication
const publicRoutes = [
  "/login",
  "/signup",
  "/magic-link",
  "/api/auth/signup",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/callback",
  "/api/health",
  "/api/v1/",
  "/api/webhooks/",
  "/api/v1/demo-requests",
  "/docs/api",
  "/docs",
  "/terms",
  "/pilot",
  "/pricing",
  "/blog",
  "/status",
  "/",
  "/landing",
];

// API routes that require authentication
const protectedApiRoutes = ["/api/org", "/api/billing", "/api/onboarding", "/api/admin", "/api/raas", "/api/affiliate"];

// Billable API routes that require MCU balance check
const billableApiRoutes = [
  "/api/proposals/generate",
  "/api/proposals/",
  "/api/video/",
];

/**
 * Check MCU balance for billable API routes
 */
async function checkMcuBalance(
  request: NextRequest,
  orgId: string
): Promise<NextResponse | null> {
  // Skip balance check for non-billable routes
  const isBillablePath = billableApiRoutes.some(path =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (!isBillablePath) {
    return null;
  }

  // Import dynamically to avoid circular deps
  const { checkBalance, requireBalance } = await import(
    '@/lib/billing/balance-checker'
  );

  const balance = await checkBalance(orgId);
  return requireBalance(
    balance,
    'Insufficient MCU balance. Please add credits to continue.'
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Unique request ID for distributed tracing
  const requestId = crypto.randomUUID();

  /** Attach security headers + X-Request-Id to every response */
  function withRequestId(res: NextResponse): NextResponse {
    res.headers.set('X-Request-Id', requestId);
    res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    res.headers.set('X-Content-Type-Options', 'nosniff');
    res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    return res;
  }

  // Rate-limit auth endpoints (10 req/min/IP)
  if (pathname.startsWith('/api/auth/')) {
    const ip = request.headers.get('cf-connecting-ip')
      ?? request.headers.get('x-forwarded-for')?.split(',')[0].trim()
      ?? 'unknown';
    if (!checkRateLimit(ip)) {
      logger.warn('Rate limit exceeded', { path: pathname, ip });
      return withRequestId(
        NextResponse.json(
          { error: 'Too many requests. Please try again later.' },
          { status: 429 },
        ),
      );
    }
  }

  // Workaround: opennextjs-cloudflare index route bug
  // Rewrite / to /landing internally (URL bar stays as /)
  if (pathname === '/') {
    return NextResponse.rewrite(new URL('/landing', request.url));
  }

  // Check if route is public
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  if (isPublicRoute) {
    return withRequestId(NextResponse.next());
  }

  // If JWT_SECRET not configured, auth is unavailable
  if (!process.env.JWT_SECRET) {
    if (pathname.startsWith("/api/")) {
      return withRequestId(NextResponse.json({ error: "Auth not configured" }, { status: 503 }));
    }
    // Redirect page requests to /status so user can see config state
    return NextResponse.redirect(new URL("/status", request.url));
  }

  // Check for auth cookie
  const hasAuthCookie = request.cookies.has("auth-token");

  // Handle API routes
  if (pathname.startsWith("/api/")) {
    const isProtectedApi = protectedApiRoutes.some(
      (route) => pathname === route || pathname.startsWith(route + "/")
    );

    if (isProtectedApi && !hasAuthCookie) {
      return withRequestId(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }

    // Check MCU balance for billable routes
    if (hasAuthCookie) {
      // SECURITY FIX: Derive org_id from authenticated session, NOT from header
      // The x-org-id header is user-controllable and must not be trusted
      const token = request.cookies.get("auth-token")?.value;
      let orgId: string | null = null;

      if (token) {
        // Extract org_id from verified JWT token (D1-native auth)
        try {
          const { verifyJwt } = await import('@/lib/db/auth-verify');
          const payload = await verifyJwt(token);

          if (payload?.org_id) {
            orgId = payload.org_id as string;
          } else if (payload?.sub) {
            // Fall back to looking up org from D1
            const { getUserOrganization } = await import('@/lib/db/auth');
            const org = await getUserOrganization(payload.sub as string);
            orgId = org?.id ?? null;
          }
        } catch (error) {
          logger.error('Failed to extract org_id from session', error, { path: pathname, method: request.method });
          return withRequestId(
            NextResponse.json({ error: 'Unable to verify organization' }, { status: 401 })
          );
        }
      }

      if (orgId) {
        const balanceResponse = await checkMcuBalance(request, orgId);
        if (balanceResponse) {
          return withRequestId(balanceResponse);
        }
      }
    }

    return withRequestId(NextResponse.next());
  }

  // Handle page routes — redirect to login if not authenticated
  if (!hasAuthCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return withRequestId(NextResponse.next());
}

// Configure which routes the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
