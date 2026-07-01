# Phase 5 — High API Security Fixes

**Status:** pending | **Priority:** P1 | **Effort:** 3h

## Context
- Parent: [plan.md](plan.md)
- Source: [security-audit-report](../../reports/security-audit-260701-0428-full-codebase.md)

## Findings Addressed

| ID | Severity | File | Issue | Fix |
|----|----------|------|-------|-----|
| H4 | High | `checkout/route.ts:83`, `proposals/route.ts:36`, `campaigns/route.ts:75`, `schedule/route.ts:99,155,217` | Missing CSRF on mutations | Add `verifyCsrfToken()` |
| H5 | High | `src/app/api/account/route.ts:35-42` | Static delete header | Add CSRF token check |
| H6 | High | `src/seed/db/repositories/batch-jobs-repo.ts:129-131` | SQL string interpolation | Validate type or parameterize |
| M7 | Medium | `check-access/route.ts`, `media/status/route.ts`, `sop-marketplace/route.ts` | Missing Zod validation | Add Zod schemas |
| M8 | Medium | `src/app/api/webhooks/telegram/route.ts:83-89` | Optional webhook secret | Make mandatory in prod |
| M9 | Medium | `overage-billing-signature-verifier.ts:35-54` | Dual signature (raw + base64) | Remove base64 fallback |

## Key Files
- `src/app/api/checkout/route.ts` — CSRF (H4)
- `src/app/api/proposals/route.ts` — CSRF (H4)
- `src/app/api/campaigns/route.ts` — CSRF (H4)
- `src/app/api/schedule/route.ts` — CSRF (H4)
- `src/app/api/account/route.ts` — CSRF on delete (H5)
- `src/seed/db/repositories/batch-jobs-repo.ts` — SQL interpolation (H6)
- `src/app/api/check-access/route.ts` — Zod (M7)
- `src/app/api/media/status/route.ts` — Zod (M7)
- `src/app/api/sop-marketplace/route.ts` — Zod (M7)
- `src/app/api/webhooks/telegram/route.ts` — mandatory secret (M8)
- `src/app/api/webhooks/overage-billing/overage-billing-signature-verifier.ts` — single signature (M9)

## Success Criteria
- [ ] All state-changing API routes verify CSRF token
- [ ] Account deletion requires CSRF + custom header (defense-in-depth)
- [ ] batch-jobs-repo costCents validated before SQL interpolation
- [ ] check-access, media/status, sop-marketplace have Zod validation
- [ ] Telegram webhook requires secret in production
- [ ] Overage billing signature verifier uses single canonical format
- [ ] All existing tests pass
