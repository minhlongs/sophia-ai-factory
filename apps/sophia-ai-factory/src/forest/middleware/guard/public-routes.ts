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
    '/api/aeo/markdown',
    '/api/aeo/indexnow',

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
    '/api/webhooks/telegram',
    '/api/webhooks/nowpayments',
    '/api/webhooks/clickbank',
    '/api/webhooks/shopify',
    '/api/webhooks/stripe',
    '/api/webhooks/payos',
    '/api/webhooks/accesstrade',
    '/api/webhooks/amazon',
    '/api/webhooks/awin',
    '/api/webhooks/tiktok-shop',
    // Legacy SaaS & crypto postback delegates (per-workspace HMAC, no session)
    '/api/webhooks/saas-crypto/partnerstack',
    '/api/webhooks/saas-crypto/rewardful',
    '/api/webhooks/saas-crypto/binance',
    '/api/webhooks/saas-crypto/bybit',
    // Legacy affiliate postback delegates (per-workspace HMAC, no session)
    '/api/webhooks/affiliate/tiktok_shop',
    '/api/webhooks/affiliate/tiktok-shop',
    '/api/webhooks/affiliate/amazon_associates',
    '/api/webhooks/affiliate/amazon',
    '/api/webhooks/affiliate/clickbank',
    '/api/webhooks/affiliate/accesstrade',
    '/api/webhooks/affiliate/awin',
    // Canonical multi-tenant postback callbacks (per-workspace signature, no session)
    '/api/postback/binance-link',
    '/api/postback/binance',
    '/api/postback/bybit',
    '/api/postback/bitget',
    '/api/postback/okx',
    '/api/postback/partnerstack',
    '/api/postback/rewardful',
    '/api/postback/impact',
    '/api/postback/cj',
    '/api/postback/awin',
    '/api/postback/clickbank',
    '/api/postback/tiktok_shop',
    '/api/postback/generic',
    // Alternate PayOS IPN callback path (HMAC checksum, no session). Listed
    // explicitly because the pinned-Set rule makes new subpaths private by
    // default, and an unlisted webhook answers 401 before its signature check.
    '/api/payos/ipn',
    // Convergence vertical-slice endpoint enforces getCurrentUser() + verifyWorkspaceAccess()
    // for session calls and HMAC-SHA256 (x-mekong-signature) for external pull-workers.
    '/api/convergence/vertical-slice',

    // Internal scheduler (authenticated via CRON_SECRET in api-pipeline + route handler, not session).
    // Pinned exact-path list matching scripts/inject-scheduled-handler.mjs CRON_ROUTES so scheduled
    // dispatches reach their per-route verifyCronAuth() check instead of failing with middleware 401.
    '/api/cron/ab-winner-picker',
    '/api/cron/affiliate-payout',
    '/api/cron/affiliate-scout',
    '/api/cron/agent-cost-overrun-scan',
    '/api/cron/billing-anomaly-scan',
    '/api/cron/circuit-breaker-scan',
    '/api/cron/clearance-promote',
    '/api/cron/creative-quality-drift-scan',
    '/api/cron/d1-backup',
    '/api/cron/daily-rollup',
    '/api/cron/distribution-pipeline-scan',
    '/api/cron/dunning-advance',
    '/api/cron/email-drip',
    '/api/cron/email-outbox-flush',
    '/api/cron/error-digest',
    '/api/cron/fulfillment-reconcile',
    '/api/cron/fulfillment-retry',
    '/api/cron/handover-status-sync',
    '/api/cron/hash-chain-verification',
    '/api/cron/heartbeat',
    '/api/cron/hourly-rollup',
    '/api/cron/llm-cache-purge',
    '/api/cron/mcu-monthly-reset',
    '/api/cron/memory-consolidation',
    '/api/cron/mission-abandon-scan',
    '/api/cron/mission-reaper',
    '/api/cron/payment-reconciliation',
    '/api/cron/pending-orders-cleanup',
    '/api/cron/promo-cleanup',
    '/api/cron/promo-trial-expiry',
    '/api/cron/quota-check',
    '/api/cron/scheduled-campaigns',
    '/api/cron/slo-burn-rate',
    '/api/cron/smoke-one-time',
    '/api/cron/sop-scheduler',
    '/api/cron/status-rollup',
    '/api/cron/subscription-reminders',
    '/api/cron/uptime-check',
    '/api/cron/usage-aggregation',
    '/api/cron/video-status-sync',
    '/api/cron/wallet-rebuild',
    '/api/cron/weekly-signals-digest',
    '/api/cron/workflow-stepper',

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
  if (pathname.startsWith('/api/postback/')) return false; // default deny
  if (pathname.startsWith('/api/cron/')) return false; // default deny

  return false;
}
