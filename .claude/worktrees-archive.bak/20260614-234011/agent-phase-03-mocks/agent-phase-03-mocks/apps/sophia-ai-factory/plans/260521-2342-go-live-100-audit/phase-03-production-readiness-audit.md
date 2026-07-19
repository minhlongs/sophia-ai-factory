# Phase 03 — Production-Readiness Audit

## Context Links

- Prior baseline: `plans/reports/actual-fullstack-audit-260515-sophia.md` (10-layer, 87.5/100)
- Framework: `~/.claude/rules/on-demand/actual-fullstack-audit.md`
- Phase 1: `reports/phase-01-codebase-map.md` + researcher outputs
- Doctrine status: **SUSPENDED** for this cycle — operator-creds gaps are now real deductions
- Deploy rule: `.claude/rules/sophia-deploy-verify.md`

## Overview

- **Priority:** P1
- **Status:** pending (blocked-by Phase 1)
- **Description:** Six-axis production-readiness re-audit with doctrine ceiling removed. Each axis emits gap list with severity. Output feeds Phase 5 scorecard.

## Key Insights

- Prior audit had ceiling-locked items (QStash backup cron, Sentry sourcemap, off-CF mirror, DMARC quarantine) — these are now in-scope to score honestly
- L1 (DB) and L10 (Backup) were 7/10 each due to "operational track record" gap — code can't fix those alone, but operator commitments (Q5 unresolved) can
- Test count delta (410→956) suggests reliability axis may already have improved evidence
- 35 `console.*` refs flagged but doctrine called them "observability paths only" — re-audit for actual leak surface
- Push-guard + SHA-injection are L5 strengths — keep credit
- OpenNext 1.17.3 (prod) vs 1.19.5 (package.json) — pending upgrade noted by prior audit

## Requirements

### Functional (six audit axes)
1. **Reliability** — error rates, retry/idempotency on IPN webhook, queue dead-letter handling, cron failure visibility
2. **Scalability** — Worker CPU limit headroom, D1 hot-row analysis on tier lookups, R2 egress patterns, KV cache hit rate
3. **Security** — re-run on 0 HIGH from `npm audit`; revisit 35 `console.*`; CSP report endpoint volume; secret rotation cadence
4. **Observability** — Sentry symbolication status, log structure consistency, `/api/health` completeness, alert routing
5. **DevEx** — pre-commit hook health, `npm run` script ergonomics, local dev loop time, test wall-clock
6. **Infrastructure** — wrangler.toml bindings audit, migration application lag, R2 lifecycle rules, DNS posture (SPF/DKIM/DMARC)

### Non-functional
- Each axis emits `reports/phase-03-axis-NN-<name>.md` with: evidence, current state, gap list, severity (blocker/high/med/low), fix recipe, effort sizing (small/med/large)
- All findings cite file:line or runtime evidence (curl/wrangler output)

## Architecture

Six parallel sub-audits, one per axis. Synthesizer report at `reports/phase-03-readiness-summary.md` maps axes to 10-layer categories for Phase 5.

| Axis | Maps to 10-layer category (Phase 5) |
|---|---|
| Reliability | L1 Database + L2 Server |
| Scalability | L2 Server + L4 Cloud + L9 CDN |
| Security | L6 Security + L3 Networking |
| Observability | L7 Monitoring |
| DevEx | L5 CI/CD |
| Infrastructure | L4 Cloud + L8 Containers + L10 Backup |

## Related Code Files

**Verify live (read, no edits):**
- `wrangler.toml` — bindings, triggers, env vars
- `src/app/api/health/route.ts`, `src/app/api/version/route.ts`
- `src/app/api/payments/nowpayments/ipn/route.ts` (idempotency + replay protection)
- `src/forest/inngest/functions/*` (cron dispatch + retry config)
- `src/lib/observability/*` (Sentry forwarder, logger candidates)
- `next.config.ts` — CSP, security headers
- `.husky/pre-commit`, `.husky/pre-push`, `package.json` scripts
- `migrations/0114-user-failed-logins.sql` (rate-limit posture)
- `src/seed/security/*`

**Live commands to run:**
- `npm audit --audit-level=high`
- `curl -s https://sophia.agencyos.network/api/health`
- `curl -sI https://sophia.agencyos.network | head -20` (header snapshot)
- `wrangler tail --format json` (5-min sample for error rate)
- DNS: `dig +short TXT _dmarc.agencyos.network`, `dig +short TXT agencyos.network` (SPF)

## Implementation Steps

1. Snapshot live state: prod headers, `/api/health`, `npm audit`, DNS records → append to `reports/phase-03-state-snapshot.md`
2. Run Reliability sub-audit → `reports/phase-03-axis-01-reliability.md`
3. Run Scalability sub-audit → `reports/phase-03-axis-02-scalability.md`
4. Run Security sub-audit → `reports/phase-03-axis-03-security.md`
5. Run Observability sub-audit → `reports/phase-03-axis-04-observability.md`
6. Run DevEx sub-audit → `reports/phase-03-axis-05-devex.md`
7. Run Infrastructure sub-audit → `reports/phase-03-axis-06-infrastructure.md`
8. Synthesize → `reports/phase-03-readiness-summary.md` with gap-count + severity-mix table

## Todo List

- [x] State snapshot (live headers, audit, DNS) (report file present under reports/)
- [x] Reliability axis report (report file present under reports/)
- [x] Scalability axis report (report file present under reports/)
- [x] Security axis report (report file present under reports/)
- [x] Observability axis report (report file present under reports/)
- [x] DevEx axis report (report file present under reports/)
- [x] Infrastructure axis report (report file present under reports/)
- [x] Synthesis summary with severity mix (report file present under reports/)
- [x] Pre-populate Phase 5 evidence pool (report file present under reports/)

## Success Criteria

- 6 axis reports + 1 synthesis filed
- Every gap has severity + fix recipe + effort sizing
- Live state evidence (curl output, audit JSON) attached
- Doctrine-suspended items (QStash, Sentry sourcemap, DMARC quarantine) explicitly re-evaluated
- Phase 5 can map each axis finding to one of 10 categories

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Speculation w/o evidence | Med | High | File:line + runtime evidence mandatory per finding |
| Audit bias from prior 87.5 anchor | High | Med | Re-derive each layer score independently before reading prior |
| Wrangler tail captures sensitive data in logs | Low | Med | Sample only — do not commit raw logs; redact in reports |
| `npm audit` finds new HIGH since 5/15 | Med | High | If found → P0 blocker for Phase 5; raise immediately |

## Security Considerations

- `wrangler tail` may expose PII/secrets in logs — sanitize before quoting
- Snapshot files MUST be reviewed for token/key leakage before commit
- CSP report endpoint volume check may reveal abuse patterns — handle per `INCIDENT_RESPONSE.md`

## Next Steps

- Feeds Phase 5 scorecard directly (axis → category mapping)
- Parallel-safe with Phase 2 + Phase 4
