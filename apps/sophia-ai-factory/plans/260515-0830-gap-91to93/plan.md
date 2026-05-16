---
title: "Sophia AI Factory — 91 → 93/100 Roadmap"
description: "Close 4 remaining gap clusters: divergence, hook flake, operator creds, time-gated DNS"
status: archived-partial
priority: P0
effort: ~3-4h (excl. operator-blocked wait)
actual_effort: ~35min (Phases 01+02 only)
branch: main
tags: [fullstack, divergence, ci, dr, dns]
created: 2026-05-15
archived: 2026-05-16
final_score: 91.5/100
source: plans/reports/handover-260515-0830-gap-91to100.md §4
final_handover: plans/reports/handover-260515-0930-v3-gap-91-5to94.md
---

# Plan: Sophia AI Factory — 91 → 93+/100 [ARCHIVED PARTIAL]

**Archive note (2026-05-16):** Phases 01 + 02 shipped. Phases 03-05 deferred indefinitely — Phase 03/04 blocked on user credentials (QSTASH_TOKEN, SENTRY_AUTH_TOKEN), Phase 05 time-gated to 2026-06-12+. Resume by reviving status from `archived-partial` → `pending` when creds available or date reached.

**Verified baseline:** `f3775a8e..960dbfde` chain pushed both mirrors.
**Production divergence (resolved):** Was prod `9da5a1b7` ≠ git origin `960dbfde`. Closed via Phase 01 cherry-pick + doctrine + guard + redeploy.

## Phase List

| # | File | Scope | Effort | Score Δ | Cumulative | Status |
|---|------|-------|--------|---------|------------|--------|
| 1 | [phase-01-dv1-divergence.md](phase-01-dv1-divergence.md) | DV-1 prod/git reconciliation (P0) | 30min | 0 (unblocks) | 91/100 | **completed 2026-05-15** |
| 2 | [phase-02-dv2-flake-fix.md](phase-02-dv2-flake-fix.md) | DV-2/CN-1 writer.test.ts pollution | 1h | +0.5 | 91.5/100 | **completed 2026-05-15** (empirical — 5/5 clean) |
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

1. ~~Who owns parallel session that deployed `9da5a1b7`?~~ → Resolved Phase 01: cherry-picked from reflog ourselves.
2. ~~Are reflog hashes still fresh?~~ → Resolved Phase 01: hashes still present, cherry-pick succeeded.
3. Does Resend require DKIM TXT manual setup or auto-publishes after domain verify? → Defer to Phase 05 execution.

## Archive Summary (2026-05-16)

| Phase | Status | Result |
|-------|--------|--------|
| 01 DV-1 divergence | ✅ COMPLETED | prod 17d59a43 = origin at deploy time; doctrine + guard shipped |
| 02 DV-2 flake | ✅ COMPLETED | 5/5 clean runs; empirical resolution (YAGNI — no code fix) |
| 03 OP-1 QStash | 🔒 BLOCKED | needs QSTASH_TOKEN from operator |
| 04 OP-2 Sentry | 🔒 BLOCKED | needs SENTRY_AUTH_TOKEN from operator |
| 05 TG-1/2 DMARC/DKIM | ⏳ TIME-GATED | earliest 2026-06-12 |

**Score achieved:** 91 → **91.5/100** (+0.5 verified, Layer 5 CI reliability)
**Recurrence prevention:** prod/git divergence root cause closed via deploy-with-sha.sh push-precondition guard + CLAUDE.md doctrine.
**To resume:** flip `status: archived-partial` → `status: in-progress` when operator provides creds OR 2026-06-12 reached.
