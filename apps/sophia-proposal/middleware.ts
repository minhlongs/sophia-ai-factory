import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public routes that don't require authentication
const publicRoutes = [
  "/login",
  "/signup",
  "/magic-link",
  "/api/auth/signup",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/health",
  "/api/v1/",
  "/api/webhooks/",
  "/api/v1/demo-requests",
  "/docs/api",
  "/terms",
  "/pilot",
  "/",
];

// API routes that require authentication
const protectedApiRoutes = ["/api/org", "/api/billing"];

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

  // Check if route is public
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Check for auth cookie
  const hasAuthCookie = request.cookies.has("auth-token");

  // Handle API routes
  if (pathname.startsWith("/api/")) {
    const isProtectedApi = protectedApiRoutes.some(
      (route) => pathname === route || pathname.startsWith(route + "/")
    );

    if (isProtectedApi && !hasAuthCookie) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
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
          console.error('Failed to extract org_id from session:', error);
          return NextResponse.json(
            { error: 'Unable to verify organization' },
            { status: 401 }
          );
        }
      }

      if (orgId) {
        const balanceResponse = await checkMcuBalance(request, orgId);
        if (balanceResponse) {
          return balanceResponse;
        }
      }
    }

    return NextResponse.next();
  }

  // Handle page routes — redirect to login if not authenticated
  if (!hasAuthCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
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
