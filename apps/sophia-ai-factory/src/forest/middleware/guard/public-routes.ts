/**
 * Check if a pathname matches any of the excluded public route patterns.
 * These routes do NOT require authentication even under blanket auth guard.
 */
export function isPublicApiRoute(pathname: string): boolean {
  // Pinned exact paths only. Broad prefixes were removed (2026-08-15 security audit)
  // because any new subpath under /api/auth, /api/webhooks, /api/cron, etc. became
  // public automatically. New public endpoints must be added explicitly here.
  const exactPublic = new Set([
    // Health / status (public)
    '/api/health',
    '/api/reality-loop/health',
    '/api/sophia-index/health',
    '/api/public',
    '/api/version',
    '/api/version-badge',
    '/api/version-text',
    '/api/robots.txt',
    '/api/sitemap.xml',
    '/api/status.json',
    '/api/csp-report',
    '/api/check-access',
    '/api/openapi.json',

    // Explicit Better Auth routes (must stay public — Better Auth handles its own auth)
    '/api/auth/sign-in/email',
    '/api/auth/sign-up/email',
    '/api/auth/sign-in/password-reset/request',
    '/api/auth/sign-in/password-reset/confirm',
    '/api/auth/magic-link',
    '/api/auth/callback',
    '/api/auth/session',
    '/api/auth/logout',
    '/api/auth/mfa/setup',
    '/api/auth/mfa/verify',
    '/api/auth/mfa/challenge',
    '/api/auth/mfa/status',
    '/api/auth/mfa/disable',
    '/api/auth/admin-challenge',
    '/api/auth/youtube/callback',
    '/api/auth/youtube/disconnect',
    '/api/auth/tiktok/callback',

    // Explicit webhook routes (authenticated via signature, not session)
    '/api/webhooks/nowpayments',
    '/api/webhooks/clickbank',
    '/api/webhooks/shopify',
    '/api/webhooks/stripe',
    '/api/webhooks/payos',

    // Internal scheduler (authenticated via INTERNAL_CRON_SECRET, not session)
    '/api/cron/email-drip',
    '/api/cron/d1-backup',
    '/api/cron/usage-aggregation',
    '/api/cron/affiliate-payout',
    '/api/cron/payment-reconciliation',

    // Inngest SSE webhook
    '/api/inngest',

    // Checkout / order flows (token-based, not session)
    '/api/checkout/status',
    '/api/pricing/stripe-checkout',

    // Token-based email flows
    '/api/welcome/resend',
    '/api/welcome/validate',
    '/api/account/delete/confirm',
    '/api/account/change-email/verify',
    '/api/sign-in/email-verification',

    // Promo codes — public by design
    '/api/promo/redeem-free',
    '/api/promo/validate',
  ]);

  if (exactPublic.has(pathname)) return true;

  // Stable token-based flow prefix family
  if (pathname.startsWith('/api/sign-')) return true;
  // Better Auth owns its own auth for ALL /api/auth/* paths (catch-all route).
  if (pathname.startsWith('/api/auth/')) return true;
  if (pathname.startsWith('/api/webhooks/')) return false; // default deny
  if (pathname.startsWith('/api/cron/')) return false; // default deny

  return false;
}
