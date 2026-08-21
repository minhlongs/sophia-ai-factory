# ROADMAP.md

## Guiding Principle

Ship business proof before architectural vanity. Every milestone must either increase paid-customer confidence, protect production reliability, or reduce future rewrite risk.

## Phase 0 — Constitution Acceptance

**Goal:** freeze the operating truth before rewriting.

**Outcomes:**

- [x] Founder/CTO accepts `GOAL.md`, `AGENTS.md`, `ARCHITECTURE.md`, `EVALUATION.md`, `BUSINESS_MODEL.md`, `MONEY_GRAPH.md`, and `FOUNDER_MANIFESTO.md`.
- [x] ADRs are reviewed and accepted or rejected explicitly.
- [x] DELETE candidates are approved before any deletion. (T004 — regenerable artifacts deleted; `.agents/` preserved pending T006)
- [x] Conflicting historical docs are archived or refactored. (T002 — `.opc/goal.md` archived)

## Phase 1 — First Paying Customer Validation

**Goal:** prove the full paid flow end-to-end.

**Outcomes:**

- [ ] Warm lead demo completed.
- [ ] Customer signs up and completes BYOK setup.
- [ ] Customer pays via NOWPayments or PayOS. (P0 payment-success page fixed 2026-08-21)
- [ ] NOWPayments/PayOS IPN activates tier. (IPN pipeline validated: 30+ test files)
- [ ] Customer generates first AI video.
- [ ] Telegram commands remain functional. (validated: webhook, commands, pairing gate intact)
- [ ] Support handover doc is bilingual.

## Phase 2 — Production Hardening

**Goal:** keep production deployable and auditable.

**Outcomes:**

- [x] `npm run build` passes from `apps/sophia-ai-factory`. (verified 2026-08-21: exit 0)
- [x] `npm test` passes. (verified 2026-08-21: 7112/7112 passed, 0 failed)
- [x] `npm run type-check` passes. (verified 2026-08-21: exit 0)
- [x] `npm run deploy:full` succeeds. (verified 2026-08-21: CF-direct, SHA 88b58b8e)
- [x] `/api/version` live SHA matches local commit SHA. (88b58b8e == 88b58b8e)
- [x] Protected flows pass smoke checks. (verified 2026-08-21: health 200, login 200, dashboard→login 307, webhook 401)
- [x] Dependency audit high-risk items are triaged. (T005 complete: `plans/reports/t005-dependency-audit.md`)

## Phase 3 — Unit Economics and Pricing

**Goal:** prove BASIC tier profitability and pricing clarity.

**Outcomes:**

- [ ] BASIC tier gross margin tracked with real support time.
- [ ] BYOK cost assumption validated with first customers.
- [ ] One-time MASTER/source-code handover economics documented.
- [ ] Pricing page and checkout copy match canonical tiers.
- [ ] Affiliate payout obligations are understood before scale.

## Phase 4 — Agent Factory Productization

**Goal:** turn internal agent orchestration into a sellable feature without breaking no-tech doctrine.

**Outcomes:**

- [ ] Agent roles and limits map cleanly to tiers.
- [ ] Agent tasks, logs, feedback, and streaming status are reliable.
- [ ] Prompt variants are measurable.
- [ ] Agent memory/journaling is useful and PII-safe.
- [ ] Agent execution costs are visible in billing/usage.

## Phase 5 — Cleanup Without Rewriting

**Goal:** reduce cognitive load before future rewrites.

**Outcomes:**

- [ ] Generated artifacts deleted or gitignored.
- [ ] Stale agent run directories archived/deleted.
- [ ] Conflicting docs refactored.
- [ ] `src/lib/*` migration plan drafted.
- [ ] Apps/services ownership clarified: Sophia, 84tea, sidecars.

## Deferred Until Business Decision

- Re-enabling GitHub Actions as deploy path.
- Operator-managed observability tokens as required production gates.
- SOC 2 Type II claims.
- 99.9% SLA claims.
- Enterprise multi-tenant SLA promises.
- Rewriting Cloudflare/D1/Inngest architecture.
