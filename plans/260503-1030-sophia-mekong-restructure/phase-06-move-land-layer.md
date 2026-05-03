# Phase 06 — Move land/ Layer (Revenue + Governance)

## Context Links
- Plan: [plan.md](plan.md)
- Depends on: [phase-05-move-forest-layer.md](phase-05-move-forest-layer.md)
- Scout report: `reports/scout-260503-dependency-graph.md`

## Overview
- **Priority:** P1
- **Status:** pending
- **Effort:** 90m
- **Description:** Move land-classified files (revenue + checkout + status) into `src/land/`. Top of stack — may import seed/tree/forest. Highest sensitivity — billing logic.

## Key Insights
- land/ is at top: imports anything below; nothing imports land/.
- All checkout flows reference Polar.sh (per `payment-provider.md` rule) — no PayPal references should remain anywhere; if scout finds them, abort and clean first.
- `src/lib/billing/` may contain webhook signature verifiers — runtime config keys (env var names) must NOT change.
- Status page `/api/status.json` is consumed by external monitors — ENDPOINT URL MUST NOT CHANGE.
- File count target: ~150-300 files.

## Requirements

### Functional
- All land non-route files moved to `src/land/<original-relative-path>`
- Public route URLs unchanged: `/pricing`, `/status`, `/checkout`, `/api/checkout`, `/api/payos`, `/api/nowpayments`, `/api/status.json`
- Polar webhook signature verification still functional (test exists in `__tests__/billing/`)
- Build/test/lint pass

### Non-Functional
- Atomic commit
- Production must remain reachable after eventual deploy (Phase 09)

## Architecture
```
src/
├── seed/, tree/, forest/...
├── land/                                (NEW)
│   ├── lib/billing/...
│   ├── lib/payments/...
│   └── lib/status/...
└── app/
    ├── [locale]/pricing/page.tsx        (STAYS)
    ├── [locale]/status/page.tsx         (STAYS)
    ├── checkout/page.tsx                (STAYS)
    ├── api/checkout/route.ts            (STAYS)
    ├── api/payos/route.ts               (STAYS)
    ├── api/nowpayments/route.ts         (STAYS)
    └── api/status.json/route.ts         (STAYS)
```

## Related Code Files

### To move
- `src/lib/billing/**/*` → `src/land/lib/billing/**/*`
- `src/lib/payments/**/*` → `src/land/lib/payments/**/*`
- `src/lib/status/**/*` → `src/land/lib/status/**/*`

### Stays in place
- All `src/app/[locale]/pricing/`, `[locale]/status/`, `checkout/`, `api/checkout/`, `api/payos/`, `api/nowpayments/`, `api/status.json/` route files

### To modify (codemod)
- All importers
- Route files — imports rewritten

## Implementation Steps

1. Read scout `land` bucket
2. Sanity check: `grep -r "PayPal\|paypal" src/` — must return ZERO (rule: ALL-IN POLAR)
3. Generate move map
4. Snapshot routes
5. `git mv` batch
6. Codemod
7. Routes unchanged check
8. Build + test + lint
9. Smoke: `npm run dev` → curl all 9 production routes (use `/api/status.json` → expect 200 with valid JSON)
10. Run billing webhook signature tests: `npx vitest run --grep "polar.*webhook"` — must pass
11. Commit: `refactor(land): mekong layer 4 — revenue + governance moved to src/land/`

## Todo List

- [ ] Verify zero PayPal residue
- [ ] Split land files
- [ ] Execute moves
- [ ] Codemod imports
- [ ] Routes unchanged
- [ ] Build/test/lint
- [ ] Smoke 9 routes
- [ ] Polar webhook tests pass
- [ ] Commit

## Success Criteria
- 9 routes return 200 locally
- Polar webhook signature test passes
- Build/test/lint green
- `git status` shows ONLY renames + import updates

## Risk Assessment
- **H** Webhook signature verification regression — Polar webhooks fail in production → revenue lost. Mitigation: dedicated webhook test must pass; if missing, write one Phase 06.5.
- **H** Status endpoint shape change breaks external monitors. Mitigation: snapshot test compares `/api/status.json` body before/after.
- **M** Pricing page hardcoded checkout URL strings. Mitigation: scout greps for `/api/checkout` literal strings — verify unchanged.
- **L** Currency formatter utility moved to seed/ (Phase 03) but referenced via relative path from billing/. Mitigation: codemod handles relative path rewrites.

## Security Considerations
- HIGH: webhook secrets and Polar API keys must NOT appear in any moved file. Run secret scan after move (`npm audit signatures` + `gitleaks detect`).

## Next Steps
- **Unblocks:** Phase 07 (boundary enforcement)
- After Phase 06 completes, ALL code lives under one of seed/tree/forest/land — Phase 07 makes that permanent
