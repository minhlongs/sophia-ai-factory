---
title: "Sophia AI Factory — 91 → 93/100 Roadmap"
description: "Close 4 remaining gap clusters: divergence, hook flake, operator creds, time-gated DNS"
status: pending
priority: P0
effort: ~3-4h (excl. operator-blocked wait)
branch: main
tags: [fullstack, divergence, ci, dr, dns]
created: 2026-05-15
source: plans/reports/handover-260515-0830-gap-91to100.md §4
---

# Plan: Sophia AI Factory — 91 → 93+/100

**Verified baseline:** `f3775a8e..960dbfde` chain pushed both mirrors.
**Production divergence:** prod `9da5a1b7` ≠ git origin `960dbfde` (DV-1 P0 blocker).

## Phase List

| # | File | Scope | Effort | Score Δ | Cumulative | Status |
|---|------|-------|--------|---------|------------|--------|
| 1 | [phase-01-dv1-divergence.md](phase-01-dv1-divergence.md) | DV-1 prod/git reconciliation (P0) | 30min | 0 (unblocks) | 91/100 | pending |
| 2 | [phase-02-dv2-flake-fix.md](phase-02-dv2-flake-fix.md) | DV-2/CN-1 writer.test.ts pollution | 1h | +0.5 | 91.5/100 | pending |
| 3 | [phase-03-op1-qstash.md](phase-03-op1-qstash.md) | OP-1 register Upstash QStash cron | 15min* | +1 | 92.5/100 | blocked (needs QSTASH_TOKEN) |
| 4 | [phase-04-op2-sentry.md](phase-04-op2-sentry.md) | OP-2 SENTRY_AUTH_TOKEN deploy export | 10min* | +1 | 93.5/100 | blocked (needs SENTRY_AUTH_TOKEN) |
| 5 | [phase-05-tg-dns.md](phase-05-tg-dns.md) | TG-1 DMARC quarantine + TG-2 DKIM verify | 5min* | +1 | 94.5/100 | time-gated 2026-06-12 |

\* Effort post-cred-provision. Wall-clock blocker may extend.

## Dependencies

```
Phase 1 (DV-1) ──► BLOCKS all deploys until resolved
   │
   └─► Phase 2 (DV-2) ◄── independent, can parallelize
   │
Phase 3 (OP-1) ◄─── needs operator creds (QSTASH_TOKEN)
Phase 4 (OP-2) ◄─── needs operator creds (SENTRY_AUTH_TOKEN)
Phase 5 (TG)   ◄─── time-gated, no work until 2026-06-12+
```

**Recommended execution order:** 1 first (unblock deploy) → 2 in parallel → 3+4 when user provides creds → 5 cron triggered or skip until time.

## Out of Scope

- **Future work cluster** (FW-1..6 from handover v2 §2.5) — DR drill, monthly restore, CF billing alert, PostCSS monitor, react-compiler revisit, low-sev gaps. Defer to v3 handover.
- **G2 lint warning ratchet** below 423 — needs targeted fixes, not autofix (autofix removed load-bearing disable comment last session).
- **Ceiling above 99/100** — requires sustained operational track record (multi-month).

## Critical Risk

**ANY `npm run deploy:full` before Phase 1 completes will overwrite prod scoring + compliance Phase 08 work** (currently live at `9da5a1b7`, only in reflog). Lock deploys until DV-1 closed.

## Success Criteria

- Phase 1: `curl /api/version | jq .shortSha == git rev-parse origin/main | cut -c1-8` (prod == git)
- Phase 2: 3 consecutive `git push` runs with hook pass (no `--no-verify` workarounds)
- Phase 3: First QStash cron fire logged in `cron_run_log` table, R2 backup file uploaded
- Phase 4: Sentry release page shows current SHA with source maps attached
- Phase 5: `dig TXT _dmarc.sophia.agencyos.network` returns `p=quarantine`

## Unresolved Questions (do NOT block on these)

1. Who owns parallel session that deployed `9da5a1b7`? Need coordination for Phase 1 Path A.
2. Are reflog hashes still fresh (< 90d) for cherry-pick?
3. Does Resend require DKIM TXT manual setup or auto-publishes after domain verify?
