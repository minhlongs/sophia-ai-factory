# Application Log Retention Policy

**Document ID:** RUN-LOG-001
**Effective Date:** 2026-05-20
**Review Date:** 2026-08-20 (Quarterly)
**Owner:** Platform Ops
**Scope:** Non-audit application logs (runtime errors, request logs, cron heartbeats, structured info/warn/error events).

> For audit logs (license events, admin actions, security-relevant) see `docs/compliance/AUDIT-LOG-RETENTION.md` (SOP-AUDIT-001).

---

## 1. Log Streams

| Stream | Origin | Sink | Retention | Cost driver |
|---|---|---|---|---|
| CF Workers runtime (`console.log`/`logger.*`) | All routes + cron handlers | Cloudflare dashboard | **7 days** (CF free-tier default) | Free |
| Sentry events (errors + perf) | `Sentry.captureException`, `captureMessage`, `captureCheckIn` | Sentry org | **30 days** (Team plan) | Free tier: 5k errors/mo |
| BetterStack heartbeats | `pushHeartbeat(BACKUP_HEARTBEAT_URL)` from cron routes | BetterStack uptime | **30 days** | Free tier ok |
| D1 `cron_runs` table | `recordCronRun()` calls | D1 `sophia-raas-db` | **90 days** (rolling delete) | D1 reads/writes count toward quota |
| D1 `quota_alerts` table | `runQuotaCheck()` Sentry alerts | D1 `sophia-raas-db` | **90 days** (rolling delete) | as above |

---

## 2. Retention Rules

### 2.1 CF Workers runtime logs
- **Inherited from Cloudflare** — operator does NOT configure; CF retains 7 days for free tier.
- **Real-time tail:** `npx wrangler tail` streams live logs for active debugging.
- **Cannot extend** without paid CF Workers Logs plan (out of doctrine until customer demand).

### 2.2 Sentry retention
- Default Sentry Team-plan retention: 30 days for errors, 30 days for cron check-ins.
- Source maps optional (operator may upload `SENTRY_AUTH_TOKEN` at deploy; without it, traces are minified — see `sophia-no-tech-doctrine.md`).
- Tags applied: `cron_route`, `tier`, `route`, `env`. Use for filter rules.

### 2.3 BetterStack heartbeats
- Per-cron heartbeat URL pinged on every successful run.
- Missed heartbeat → BetterStack pages operator (configured per-runbook).
- 30-day rolling history visible in BetterStack dashboard.

### 2.4 D1 internal log tables
- `cron_runs` and `quota_alerts` rows pruned by daily cron `/api/cron/log-cleanup` (if present) or manual:
  ```sql
  DELETE FROM cron_runs WHERE created_at < datetime('now', '-90 days');
  DELETE FROM quota_alerts WHERE created_at < datetime('now', '-90 days');
  ```
- D1 read/write count toward CF free-tier quota (5M reads/100k writes per day) — monitored by `runQuotaCheck()`.

---

## 3. Operator Actions

| Trigger | Action | Frequency |
|---|---|---|
| New cron route added | Verify `logger.info`/`logger.error` calls present + `recordCronRun()` invocation | Per PR |
| Sentry quota approaching 5k errors/mo | Triage noisy errors, downgrade `captureException` to `captureMessage` where appropriate, or upgrade plan | When alert fires |
| BetterStack missed-heartbeat alert | Page on-call; investigate per `cron-escalation-contacts.md` | Real-time |
| D1 quota approaching 80% | Run cleanup SQL above; consider extending pruning window | When `runQuotaCheck` warns |
| Quarterly review | Update this doc + verify retention policies still match cost reality | Every 3 months |

---

## 4. Anti-Patterns

- ❌ Logging PII / customer API keys / payment-token bodies in any stream
- ❌ Using `console.log` directly in production code paths — use `logger.*` from `@/seed/utils/logger-utility` (structured, env-aware)
- ❌ Extending retention without first auditing cost impact against CF/Sentry/BetterStack plan limits
- ❌ Relying on CF Workers logs as the durable error source — they expire in 7d. Always also `Sentry.captureException` for errors that need post-mortem visibility

---

## 5. Cross-References

- `docs/compliance/AUDIT-LOG-RETENTION.md` — audit/security log policy (90d + 7y archive)
- `docs/runbooks/cf-quota-response.md` — quota alert response
- `docs/runbooks/cron-escalation-contacts.md` — on-call routing for heartbeat misses
- `apps/sophia-ai-factory/CLAUDE.md` — deploy doctrine (`wrangler tail` for live debug)

---

## 6. Unresolved

- Should we register `/api/cron/log-cleanup` as a scheduled CF cron? (Currently manual SQL prune.) — Doctrine question: counts toward "operator-configured cron" or not?
- BetterStack vs Sentry heartbeats — currently both wired; consider consolidating to reduce vendor count.
