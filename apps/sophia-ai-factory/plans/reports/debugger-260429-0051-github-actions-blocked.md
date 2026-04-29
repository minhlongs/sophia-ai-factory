# Debug Report — GitHub Actions Disabled at User Level

**Date:** 2026-04-29
**Severity:** P1 (operations, not blocking go-live)
**Affected:** GitHub user `longtho638-jpg` — ALL repos owned by this account

---

## Symptom

- `git push origin main` succeeds, but no Actions runs fire.
- `gh run list` returns empty.
- `gh api repos/.../actions/runs` returns `total_count: 0`.

## Root Cause

```
HTTP 422 from gh workflow run test.yml --ref main:
"Actions has been disabled for this user."
```

**This is account-level**, not repo-level. The repo's `actions/permissions` shows `{enabled: true, allowed_actions: "all"}`. The block is on the GitHub user account itself — likely GitHub's anti-abuse heuristic for new accounts (created 2026-02-05).

Common triggers:
- Phone number not verified.
- Account flagged by automated abuse detection.
- Hit on free Actions usage limits.

## Side Discovery: Dead Workflow Infra

While debugging, also found:

1. **6 workflow files in `apps/sophia-ai-factory/.github/workflows/`** — GitHub Actions only reads `.github/workflows/` at the **git root**. Subdirectory workflows are silently ignored. Files affected: `ci-cd.yml`, `deploy-worker.yml`, `pipeline.yml`, `verify.yml`, `sophia-ingestion.yml`, `cron-video-status-sync.yml`.

2. **All 14 Cloudflare Cron triggers in `apps/sophia-ai-factory/wrangler.toml` fire into the void.** OpenNext-generated `.open-next/worker.js` has only a `fetch` handler — no `scheduled` handler. So `*/5 * * * *` for `/api/cron/uptime-check`, `0 1 * * *` for `/api/cron/dunning`, etc. — **none of these are running automatically in production**. Confirmed by inspecting the generated worker.js (43 lines, no `scheduled` export).

## Fix Path

### Account-level (GH Actions reactivation)
| Option | Action | ETA |
|---|---|---|
| A1 | Verify phone at github.com/settings/security | immediate |
| A2 | Email support@github.com requesting Actions reactivation | 1-3 days |
| A3 | New GitHub account + transfer repo ownership | 30 min |

### Cron infrastructure (separate from GH Actions)
| Option | Description | Effort |
|---|---|---|
| C1 | External cron service (Upstash QStash, EasyCron, UptimeRobot) curls `/api/cron/*` URLs | 15 min setup, free tier |
| C2 | Tiny secondary Cloudflare Worker `sophia-cron-dispatcher` with `scheduled()` handler + service binding to main worker | ~2 hours, fully native |
| C3 | Patch OpenNext worker.js post-build to inject `scheduled()` | fragile, not recommended |

## Cleanup Done This Session

- Deleted: `apps/sophia-ai-factory/.github/workflows/{ci-cd,deploy-worker,pipeline,verify}.yml` (legacy duplicates of root workflows).
- Moved: `cron-video-status-sync.yml` and `sophia-ingestion.yml` to `.github/workflows/` at git root (so they will activate when GH Actions is reactivated).

## Recommended Next Action

**Pursue A1+A2 in parallel with C1.** A1+A2 to restore native GH Actions long-term; C1 to unblock production cron NOW (cron-video-status-sync, dunning, uptime-check, etc.).

Skip C2 unless GH support refuses reactivation (would justify the investment).

## Unresolved Questions

1. Were the 14 wrangler crons EVER firing? Or has the dead-handler bug existed since OpenNext migration? Cannot verify without historical Cloudflare Worker logs.
2. Does HeyGen webhook polling vs cron tradeoff still hold if cron is dead? (Webhook is still useful, but cron was the safety net.)
