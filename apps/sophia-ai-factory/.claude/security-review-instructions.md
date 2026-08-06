# Security Audit Code Review Instructions

Review the Sophia AI Factory security audit fix implementations at /Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/. These were implemented 2026-07-01. Verify CORRECTNESS of each fix and report ONLY confirmed findings.

Use ReportFindings tool with file, line, summary, failure_scenario, category, verdict=CONFIRMED fields.

## PHASE 2 — Critical API
1. src/forest/middleware/rate-limiter.ts — confirm D1-backed checkD1RateLimit for auth endpoints (C2); NEXT_PUBLIC_MOCK_AI_SERVICES not bypassing (C3, line ~59-67)
2. src/seed/security/sql-rate-limiter.ts — confirm MOCK bypass removed (M6)
3. src/seed/security/cron-auth.ts — confirm timingSafeEqual (M2) and query param ?token= removed (M3)
4. Verify these 3 files return 500 when webhook secret missing:
   - src/app/api/webhooks/amazon/route.ts
   - src/app/api/webhooks/awin/route.ts
   - src/app/api/webhooks/accesstrade/route.ts

## PHASE 3 — Payment
5. src/land/billing/nowpayments-ipn-handlers.ts — confirm stale lock (>5min) re-enqueues (C1, H7)
6. src/land/billing/nowpayments-ipn-one-time.ts — confirm amount check vs sku.priceUsd (H8) and ON CONFLICT DO UPDATE (H10)
7. src/app/api/admin/refunds/[id]/route.ts — confirm WHERE status='pending' (H9) and audit log before UPDATE (M17)

## PHASE 4 — Auth
8. src/seed/auth/mfa/login-challenge.ts — confirm MFA expiry invalidates session (H1)
9. src/app/api/auth/admin-challenge/route.ts — confirm totp_secret_enc not plaintext (H2)
10. Verify all admin routes use requireAdmin() or requireAdminWithRecentAuth:
    grep -rn "requireAdmin" src/app/api/admin/ | wc -l (should be significant)
11. src/seed/auth/better-auth-server.ts — confirm password policy config (M10)
12. src/app/api/auth/logout/route.ts — confirm auth.api.revokeSession() (M11)
13. src/middleware/cors.ts — confirm origin allowlist not wildcard (M12)

## PHASE 5 — API Security
14. Verify CSRF token checks in mutation routes:
    - src/app/api/checkout/route.ts
    - src/app/api/proposals/route.ts
    - src/app/api/campaigns/route.ts
    - src/app/api/schedule/route.ts
15. src/app/api/account/route.ts — confirm CSRF + custom header on delete (H5)
16. src/seed/db/repositories/batch-jobs-repo.ts — confirm costCents validated before SQL (H6)
17. Verify Zod schemas in:
    - src/app/api/check-access/route.ts
    - src/app/api/media/status/route.ts
    - src/app/api/sop-marketplace/route.ts (M7)
18. src/app/api/webhooks/telegram/route.ts — confirm webhook secret mandatory in prod (M8)
19. src/app/api/webhooks/overage-billing/overage-billing-signature-verifier.ts — confirm single signature format (M9)

## PHASE 6 — Infra
20. src/middleware/cors.ts — origin allowlist (M1)
21. src/app/api/csp-report/route.ts — document-uri/referrer scrubbed (M4)
22. src/app/api/health/route.ts — generic error to client (M5)
23. src/seed/security/content-security-policy-configuration.ts — unsafe-inline documented (L1)
24. src/middleware.ts — security headers on error responses (L2)
25. src/seed/security/account-lockout.ts — degraded state on DB error (L3)
26. .env.production.example — no dead ADMIN_USER/ADMIN_PASS (L4)
27. src/seed/config/environment-config.ts — UPSTASH Redis optional (L5)
28. src/seed/cache/edge-cache.ts — Vary: Origin preserved (L6)

For each: confirm implemented, partially, or missing. Only report CONFIRMED security gaps.
