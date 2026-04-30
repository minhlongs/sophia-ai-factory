# Phase 11 — Tenant Isolation + Quota Tiers

## Status: PENDING (after Phase 10)

## Goal
Multi-tenant isolation + tiered quotas + cost ledger.

## Tiers
| Tier | Price | Videos/mo | Cinematic | Voice clones |
|------|-------|-----------|-----------|--------------|
| BASIC | $9 | 10 template | 0 | 0 |
| PREMIUM | $49 | 50 template + 5 cinematic | 5 | 3 |
| ENTERPRISE | $197 | unlimited template + 30 cinematic | 30 | 10 |
| MASTER | $497 | white-label, unlimited | unlimited | unlimited |

## Deliverables
- [ ] D1 RLS policies per tenant_id
- [ ] Quota enforcement middleware
- [ ] Cost ledger: aggregate $ per tenant per month
- [ ] Overage billing trigger
- [ ] Per-tenant memory: SQLite + ChromaDB (per SYNTHESIS § 6)

## Files
- `apps/sophia-ai-factory/lib/tenant/quota-gate.ts`
- `apps/sophia-ai-factory/lib/tenant/cost-ledger.ts`
- `apps/sophia-ai-factory/middleware.ts` (RLS injection)

## Risk: Medium — D1 RLS support limited, may need app-level enforcement

## Effort: 5-7 days
