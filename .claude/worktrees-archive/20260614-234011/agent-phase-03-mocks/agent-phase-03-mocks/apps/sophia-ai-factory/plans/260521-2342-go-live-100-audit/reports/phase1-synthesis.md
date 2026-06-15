# Phase 1 — Codebase Intelligence Synthesis

**Date:** 2026-05-21
**Audit:** Go-Live 100/100 (doctrine suspended for this cycle)
**Live anchors:** HEAD `d68b4d96` (ahead 1 unpushed) · prod SHA `b8c4f6dd` · live 20h ago · sophia.agencyos.network

## Source reports

| # | Subsystem | File |
|---|-----------|------|
| 1 | Worker + cron entry points | `research/researcher-01-worker-and-crons.md` |
| 2 | D1 schema graph | `research/researcher-02-d1-schema-graph.md` |
| 3 | Auth + tier model | `research/researcher-03-auth-tier-model.md` |
| 4 | CF-direct deploy chain | `research/researcher-04-deploy-chain.md` |
| 5 | BYOK setup wizard | `research/researcher-05-byok-wizard.md` |
| 6 | Test infrastructure | `research/researcher-06-test-infra.md` |
| T | Dirty-tree triage | `reports/phase1-dirty-tree-triage.md` |

## Verified facts (anchored to live state)

- **Migrations:** 117 sequential, all applied to remote `sophia-raas-db` (78bd1961). Latest `0117-refresh-video-generation-starter-sop.sql`. Tag-cache DB separate (7b1d4fd4). `0120` local count per deploy-chain report — needs reconciliation.
- **Test suite:** 475 vitest files / 4,702 cases (4,668 pass + 34 skip) + 29 Playwright e2e + 3 smoke. Prior `410` and `956` were counting artifacts. Coverage gate: 0% global / 4% dashboard.
- **Crons:** 18 patterns wired in wrangler.toml dispatching to 30 route handlers → **12 unscheduled/manual/possibly dead** (audit candidate Phase 4).
- **Deploy:** 6-gate pipeline (G0 push, G0.5 typecheck, G1-G5 pre-push hook) via `npm run deploy:full`. CF-direct canonical, GH Actions disabled by design.
- **Auth:** Better Auth + 7-day sessions + dual-layer MASTER tier gate (middleware + page redirect) compensating for edge D1 unavailability.
- **BYOK:** `user_provider_credentials` table, AES-GCM-256 + randomized IV, master key `BYOK_MASTER_KEY`. No plaintext leak surface found.

## Cross-cutting findings (feed Phases 2-5)

### Reliability gaps
- Cron handler/declaration mismatch (30 handlers, 18 scheduled) — risk: dead code or missed scheduling.
- D1 backup is manual cron `/api/cron/d1-backup`; no automated restore drill. **R2 30d lifecycle does not test restorability.**
- Migrations require manual `npm run deploy:migrations` post-deploy — no enforcement. Drift possible.

### Security gaps
- Cross-tenant query risk: `campaigns` table keyed on `user_id` only (no `org_id`), `signals_events` has nullable `org_id`. Multi-tenant isolation is query-time only (no D1 RLS).
- **B2 fix in unpushed commit** addresses HeyGen webhook cross-tenant leak — currently un-shipped.
- No immutable audit log for BYOK credential mutations.
- BYOK master key rotation procedure undocumented.

### Observability gaps
- Sentry SDK wired but sourcemap upload optional (now in-scope with doctrine lifted).
- No tenant-level cost telemetry visible to customers.
- Coverage gate effectively 0% — observability of test quality is theatrical.

### DevEx gaps
- 341 ESLint warnings baseline (was 423; trending down).
- `OPENNEXT_VERSION` hardcoded `"1.17.3"` at `src/app/api/version/route.ts:33` while package declares `^1.19.5` (Phase 4 fix).
- Hot tables `missions`, `publishing_jobs` missing `(org_id, status)` compound index.
- Legacy Supabase tables (`memory_kv`, `supabase_migrations_applied`) still in schema.

### Scalability gaps
- D1 lookups fail silently at edge middleware → page-level redirect compensation is fragile under load.
- No per-org quotas on API key / credential count.
- Tag-cache DB coupled to OpenNext minor version; 1.20 bump may break revalidations schema.

### Documentation gaps
- Master-key rotation runbook missing.
- DR drill procedure missing.
- `enriched-jwt.ts` purpose unclear (may be replaced by NOWPayments IPN).
- 12 dead cron handlers undocumented.

## Unresolved questions for user

1. **Operator credentials.** User chose "provision all 3 + score honestly if blocked" — confirm intent to provide QSTASH_TOKEN, SENTRY_AUTH_TOKEN, DMARC DNS access before Phase 3? Or score honestly first, then provision against the gap list?
2. **Dirty tree disposition.** Triage recommends SHIP. Includes B2 cross-tenant leak fix — already un-shipped 1+ day. See decision section below.
3. **Migration count drift.** Researcher-02 says 117 applied; researcher-04 says 120 local. Reconcile before Phase 4.
4. **Cron handler audit.** Confirm scope: are 12 unscheduled handlers (a) intentionally manual, (b) deprecated, (c) forgotten?
5. **OpenNext version sync mechanism.** What's the right pattern — read from `package.json` at build, or `__OPENNEXT_VERSION__` define?

## Status

**Phase 1: COMPLETE.** Gating on user decisions above before Phase 2 begins.
