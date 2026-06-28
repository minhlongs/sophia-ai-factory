# Phase 3 — Axis 6 — Infra & Cost Audit (Honest, Doctrine SUSPENDED)

**Date:** 2026-05-22
**Auditor:** Axis 6
**Subject:** Sophia AI Factory — Infrastructure & Cost posture for GO-LIVE 100/100
**Prod:** https://sophia.agencyos.network · SHA `d86659bf` · CF Workers + D1 + R2 + KV
**Doctrine note:** `sophia-no-tech-doctrine.md` ceiling 91.5/100 is SUSPENDED for this scoring. Operator-side gaps that the doctrine waives ARE counted here. Read the doctrine as a self-imposed constraint, not a free pass.

---

## Score Summary

| # | Sub-area | Score |
|---|---|---:|
| 1 | Deploy pipeline robustness | **5/10** |
| 2 | Multi-region / DR posture | **4/10** |
| 3 | Capacity planning | **6/10** |
| 4 | Cost model & alerting | **5/10** |
| 5 | Vendor lock-in & portability | **3/10** |
| 6 | Compliance posture (RaaS + crypto) | **3/10** |
| **TOTAL** | | **26/60** |

Net: **43.3%** of available infra/cost points. Honest read — Sophia is fine for a sub-$200/mo single-operator product, NOT fine for a multi-tenant RaaS handling third-party crypto payments at scale.

---

## 1. Deploy Pipeline Robustness — 5/10

**Evidence**
- Canonical deploy: `scripts/deploy-with-sha.sh` (wrangler CLI direct). `package.json:38` `deploy:full` chain.
- GH Actions disabled by design — `apps/sophia-ai-factory/CLAUDE.md` "GitHub Actions disabled by design since 2026-05-03" (`.github/workflows/test.yml.disabled`).
- Retry helper for CF API 502s (`scripts/deploy-with-sha.sh` `retry_cf()`, 3 attempts exp backoff).
- Push-before-deploy precondition (`deploy-with-sha.sh` rejects unpushed HEAD with exit 2; bypass via `ALLOW_UNPUSHED_DEPLOY=1`).
- SHA-match verification mandatory (`sophia-deploy-verify.md` step 3 — `/api/version.shortSha`).
- M1 16GB build OOM scars: Turbopack forced because webpack `nft` OOM-kills (deploy-with-sha.sh header). Tradeoff: PWA service-worker generation silently dropped.

**Honest concerns (doctrine waives, audit doesn't)**
- **Single-machine deploy.** Build runs only on operator's M1 16GB MacBook. If macbook dies/stolen/lost wrangler auth, no one can ship. No backup builder. No documented "deploy from clean machine in 60 min" runbook.
- **Wrangler-CLI single point of failure.** If `wrangler` is broken upstream or operator's CF API token revoked, deploy blocked. No fallback to GH Actions (`.disabled`) without re-enabling Actions account-wide.
- **No staging gate in default flow.** `deploy:full` goes straight to prod. `wrangler.staging.toml` exists but `deploy:staging` is a separate manual command — not enforced before `deploy:full`.
- **Build artifact not versioned.** No `.open-next/worker.js` archive per release. Rollback relies on `wrangler rollback` (CF-side history, opaque retention).
- **Drift:** `@opennextjs/cloudflare ^1.19.5` in package.json but production reportedly runs 1.17.3 (per prior fact pack). Indicates deploy script may not reinstall on every run. Worth verifying.

**Score rationale:** Pipeline is mechanically sound (retry, SHA verify, push-gate) but operationally brittle (one human, one laptop, one auth). 5/10.

---

## 2. Multi-Region / DR Posture — 4/10

**Evidence**
- Workers global edge → ~5/5 for read path (CF runs everywhere).
- **D1 single-region (APAC).** Documented in `docs/runbooks/d1-region-failure.md`: "D1 is single-region. No automatic failover. If APAC zone degrades, database is unavailable until Cloudflare resolves it."
- RPO=24h, RTO=4h per `docs/deployment-guide.md:299-301`.
- D1 backup route exists (`src/app/api/cron/d1-backup/route.ts`) with 50 MiB dump ceiling, 12h idempotency, BetterStack heartbeat.
- R2 `sophia-backups` bucket exists with 30-day lifecycle (`docs/runbooks/r2-storage-policy.md` §2.3).
- Cron `crons = [...]` array in `wrangler.toml:60` includes daily 03:00 UTC slot for backup — **CF Worker cron is wired**, contradicting older "Upstash QStash external cron" doctrine notes. Good.
- Operator playbook: SOP 11 (manual), SOP 14 (QStash), SOP 15 (quarterly DR drill).

**Honest concerns**
- **Single D1 = single point of total data loss** if CF APAC region permanently fails or rolls a corrupt update. No cross-region replica. No read-replica even in same region.
- **Zero verified DR drills.** SOP 15 cadence "Q1=Feb, Q2=May, Q3=Aug, Q4=Nov" — Q2 May 2026 should have happened already; no evidence of completion. RTO=4h is paper, not measured.
- **Backup ceiling 50 MiB** (`src/app/api/cron/d1-backup/route.ts:43`). When real RaaS data crosses 50 MiB the cron will start FAILING SILENTLY without prior streaming/multipart upload work. "Future enhancement" comment.
- **`MAX_ROWS_PER_TABLE=100k` cap** — tables exceeding this are truncated with a marker, NOT a hard fail. Restore from such backup = data loss.
- **R2 30-day retention only.** Older monthly/quarterly snapshots gone — no long-term recovery (e.g., "what did our DB look like 6 months ago for legal discovery").
- **Source code:** GitHub + local mirror, no off-site (e.g., GitLab/codeberg) automated push verified in deploy flow.
- **Secrets:** "Operator notebook (encrypted) holds `wrangler secret list` export" (deployment-guide.md:312). Single-operator vault. No team escrow.

**Score rationale:** Edge read-path is great, write-path/data is one region + one laptop away from catastrophe. 4/10.

---

## 3. Capacity Planning — 6/10

**Evidence**
- `runQuotaCheck()` at `src/seed/observability/quota-check.ts` (referenced by `docs/runbooks/cost-monitoring.md` §2.1), alerts at 70/90/100% bucket fill.
- Worker bundle "well under 1 MB" per cost-monitoring.md §4 cold-start guidance.
- 18 distinct cron schedules in `wrangler.toml:60` — heavy cron footprint (every-2-min, every-5-min, every-10-min, every-15-min, hourly, daily, monthly). Each = invocation cost.
- 123 migrations in `migrations/` directory (heavy schema surface).
- Workers free 100k/day → paid $5/mo+$0.30/M; D1 free 5M reads + 100k writes/day.

**Honest concerns**
- **No capacity model document.** "What's our requests/D1-reads/storage projection at 100 tenants / 1k tenants?" — not answered anywhere. Cost-monitoring.md says "~$19 current / ~$173 at 10×" but the math behind 10× is undocumented and "10×" of what baseline isn't defined.
- **Cron storm risk.** `"*/2 * * * *"` + `"*/5 * * * *"` + `"*/10 * * * *"` + `"*/15 * * * *"` running on every Worker invocation tick. At 2/min that's 720k cron invocations/month from a single schedule. Multiple bin-packed near-simultaneously (e.g., `0 1`, `0 2`, `0 3`, `0 4` UTC) — risk of D1 contention during these windows.
- **D1 row limits not documented per table.** D1 has a 10 GB per database soft cap (per CF docs). No tracking of which tables grow unbounded (`cron_run_log`, `lifecycle_email_log`, `usage_events`, `quota_alerts`).
- **R2 ops untracked.** `docs/runbooks/cost-monitoring.md:23-24` literally says "R2 Class A ops" and "R2 Class B ops" are "(untracked)" — these are typically the budget-killer at scale (4.50/M writes, 0.36/M reads).
- **Worker CPU limit:** 30s wall clock / 50ms CPU on paid plan — no current alerting on near-limit invocations. D1 backup `buildD1Dump` over 50 MiB will exceed CPU.

**Score rationale:** Quota check exists + some thresholds documented. No real capacity model, R2 ops untracked, table-level growth blind. 6/10.

---

## 4. Cost Model & Alerting — 5/10

**Evidence**
- `docs/runbooks/cost-monitoring.md` lists ~$0/mo current operator cost (everything in free tiers per the file).
- §2.3 manual monthly billing review checklist.
- §3 anomaly trigger table.
- Quota route alerts via Sentry (no PagerDuty/SMS).
- `runQuotaCheck()` ties into Sentry — operator must check Sentry to see alerts.

**Honest concerns**
- **No CF spend cap configured** (SOP 13 — `docs/dev-sops.md:355` says "Dashboard-only — no API automation for billing alerts on standard plans"). A runaway loop could hit hundreds of dollars overnight before manual review.
- **Monthly billing review = manual.** Reliance on a human running the checklist on the 1st of each month. Realistically operators skip this for 2-3 months and discover a $400 bill.
- **No budget projection per tenant.** RaaS is multi-tenant — but no per-tenant cost attribution exists. If one tenant runs a video-generation loop, cost spikes are attributed to the platform globally.
- **"~$19/mo current / ~$173/mo at 10×"** projection mentioned in fact pack is not in any source-of-truth file I can find. Even `cost-monitoring.md` doesn't carry that number — it says "$0/mo current". Either the $19 figure is stale Sentry-team-plan + Resend-pro spend, or it's just unwritten guesswork.
- **Sentry 5k events/mo free tier** — a single deploy with a bad regression can blow that in hours. No graceful degradation path.
- **No alert on cost surface deltas.** Anomaly trigger table is a manual-response reference, not a wired alert.

**Score rationale:** Cost surfaces enumerated, manual cadence documented, but zero automated cost-side alerting and no per-tenant attribution. 5/10.

---

## 5. Vendor Lock-in & Portability — 3/10

**Evidence**
- Hard couplings: **D1** (CF proprietary SQLite), **R2** (CF), **KV** (CF), **OpenNext on Cloudflare adapter** (`@opennextjs/cloudflare`), **Workers runtime** (V8 isolate, not Node), **Wrangler CLI**, **CF DNS**, **CF SSL/CAA**.
- `wrangler.toml` is the source of truth — non-portable artifact.
- App-level abstraction: `@/seed/db/client` returns a D1Database directly — no repository pattern.
- `next.config` uses `output: 'standalone'` only as input to OpenNext; raw Next.js cannot deploy elsewhere without OpenNext adapter swap.

**Honest concerns**
- **D1 is the deepest lock-in.** 123 migrations of SQLite-flavored SQL with CF-specific limits (no extensions, no triggers in some cases, no foreign-key cascades fully respected pre-PRAGMA). Migrating to Postgres/Supabase = months of work (schema rewrite + ORM swap + data migration + cron-handler rewrite + R2 → S3 swap + Worker → Node rewrite).
- **R2 → S3 is the easiest swap** but `BACKUPS_BUCKET`/`VIDEO_BUCKET` are wired via CF bindings, not S3 SDK. Code change required.
- **No escape-hatch SOP.** No document says "if CF terminates Sophia's account tomorrow, here is the 14-day plan to relocate to Vercel/Fly/Render."
- **Email lock-in:** Resend hard-coded sender addresses (deployment-guide.md:351-354). Multiple sender domains adds DNS complexity.
- **Better Auth** is portable but session storage is D1-backed.

**Score rationale:** Maximum CF lock-in. Portability is theoretical; no exit plan exists. 3/10.

---

## 6. Compliance Posture (RaaS + Crypto Payments) — 3/10

**Evidence**
- `docs/compliance/AUDIT-LOG-RETENTION.md` covers SOC 2 / PCI DSS / GDPR retention policy.
- `docs/CLIENT-HANDOVER-PACKAGE-v2.md:87` claims "ASVS L2: 29 Pass / 0 Fail / 3 N-A = 94% compliance" (security verification, not compliance certification).
- Per-jurisdiction crypto disclaimer at `src/seed/compliance/crypto-disclaimer-*.ts` for US/EU/VN/SG/JP (system-architecture.md:359).
- Better Auth handles session + user data.
- NOWPayments + PayOS are upstream-PCI — Sophia never sees card data.

**Honest concerns (THIS IS THE BIG GAP)**
- **No real SOC 2 / ISO 27001 / PCI DSS certification.** "94% ASVS pass rate" ≠ SOC 2 Type II audit. Real enterprise customers (which RaaS targets) will ask for SOC 2 report — Sophia has none.
- **GDPR data subject rights:** No documented user-facing "export my data" / "delete my account" UI flow with verified deletion across D1 + R2 + KV + Sentry. `user-cleanup` cron mentioned in ARCHITECTURE.md:138 but no DPA-compliant audit trail.
- **GDPR data residency:** Per `d1-region-failure.md`, D1 is APAC. EU customer data sitting in APAC region = potential GDPR violation (Schrems II concerns, adequacy decisions). No mechanism to pin EU tenant data to EU region.
- **Crypto AML/KYC:** NOWPayments handles their own KYC, BUT Sophia is a RaaS where end-customers (tenants) receive USDT payouts via affiliate/conversion ledger. Sophia is operationally facilitating crypto payouts — depending on jurisdiction this could trigger MSB/VASP registration requirements. Per-jurisdiction "disclaimer" is the cheapest possible legal posture, not compliance.
- **PCI DSS:** Audit-log retention doc cites PCI DSS 1-year archive requirement as "Q3 2026 future" (`docs/compliance/AUDIT-LOG-RETENTION.md:246`) — not implemented. If any tenant's NOWPayments key ever leaked through Sophia (logs, error capture), PCI scope explodes.
- **No DPA template** for tenants who must sign one with their own users.
- **No incident response runbook for data breach.** `r2-storage-policy.md` and others are operational, not regulatory. 72-hour GDPR notification clock has no SOP.
- **Privacy policy / Terms of Service / Cookie consent banner:** not verified live in this audit (out of scope but commonly missing).
- **Audit log retention:** doc exists, but archive automation not implemented → 90-day D1 retention only → fails PCI 1-year minimum on day 91.

**Score rationale:** Documentation aspirations exceed implementation. For a multi-tenant RaaS handling crypto with EU/US users, this is the most undercooked axis. 3/10.

---

## Top P0/P1 Findings

### P0 (block GO-LIVE 100/100)
1. **Single-region D1 + zero verified DR drills.** RTO=4h is paper. Run actual restore exercise on staging D1, document elapsed time, fix gaps. (Axis 6 #2)
2. **No CF spend cap / cost alert.** A runaway cron loop or D1 query storm could hit $1k+ overnight. Configure CF dashboard billing alert at $50/$100/$200 thresholds today. (Axis 6 #4)
3. **Backup 50 MiB ceiling will silently fail when crossed.** Implement streaming/multipart R2 upload BEFORE prod data crosses that line, not after. (Axis 6 #2/#3)
4. **GDPR data residency mismatch (D1 APAC, EU customer data).** Either block EU tenant signups in ToS or document Schrems II legal basis. (Axis 6 #6)
5. **No SOC 2 / no PCI DSS automation.** If pitching enterprise or any tenant handling cards through their NOWPayments — block enterprise tier launch until SOC 2 Type I at least. (Axis 6 #6)

### P1 (must address pre-scale)
6. **Single-operator deploy + secrets vault.** Document "deploy from clean machine in 60 min" runbook + team-shared secret escrow (1Password/Bitwarden vault). (Axis 6 #1)
7. **OpenNext drift 1.17.3 prod vs 1.19.5 manifest.** Verify and align; pin in package.json. (Axis 6 #1)
8. **R2 Class A/B ops untracked.** Wire usage metering for write/read ops counters — these are the budget killers. (Axis 6 #3/#4)
9. **No per-tenant cost attribution.** RaaS without per-tenant cost telemetry = inevitable margin death. Tag invocations with tenant_id, roll up in cron. (Axis 6 #4)
10. **Source code off-site mirror not in deploy flow.** Automate GitLab/Codeberg push as part of `deploy:full` Step 0. (Axis 6 #2)
11. **123 migrations + no documented squash/baseline strategy.** First-time D1 restore replays all 123 — slow and brittle. (Axis 6 #3)
12. **Quarterly DR drill Q2 May 2026 overdue.** Schedule + execute, record actual RTO. (Axis 6 #2)
13. **No vendor exit plan.** Write a 1-page "14-day CF account loss" runbook so it isn't invented during an incident. (Axis 6 #5)

---

## Citations

- `apps/sophia-ai-factory/wrangler.toml:1-170` — bindings + cron triggers
- `apps/sophia-ai-factory/scripts/deploy-with-sha.sh:1-60` — deploy pipeline + retry helper
- `apps/sophia-ai-factory/package.json:38-44` — deploy scripts
- `apps/sophia-ai-factory/src/app/api/cron/d1-backup/route.ts:36-46` — MAX_DUMP_BYTES=50MiB ceiling
- `apps/sophia-ai-factory/docs/deployment-guide.md:292-330` — DR §8 RPO/RTO
- `apps/sophia-ai-factory/docs/dev-sops.md:267-501` — SOP 11/14/15 backup + drill
- `apps/sophia-ai-factory/docs/runbooks/r2-storage-policy.md:1-100` — R2 retention
- `apps/sophia-ai-factory/docs/runbooks/cost-monitoring.md:1-100` — cost surfaces + manual review
- `apps/sophia-ai-factory/docs/runbooks/d1-region-failure.md:1-80` — single-region D1 acceptance
- `apps/sophia-ai-factory/docs/compliance/AUDIT-LOG-RETENTION.md:1-260` — retention policy
- `apps/sophia-ai-factory/.claude/rules/sophia-no-tech-doctrine.md` — doctrine SUSPENDED for this audit

---

## Unresolved Questions

1. Actual prod OpenNext version — 1.17.3 (fact pack) vs ^1.19.5 (package.json manifest). Needs `curl /api/version` confirmation.
2. Where is "~$19/mo current / ~$173/mo at 10× load" figure sourced from? cost-monitoring.md says $0/mo current — discrepancy unresolved.
3. Has Q2 May 2026 DR drill actually been run? No evidence in `plans/` or `docs/runbooks/`.
4. EU tenant signup posture — is there any UI/ToS gate, or is it accepted as known risk?
5. Does NOWPayments-as-MSB satisfy Sophia's facilitator-of-crypto-payouts obligations across all 5 disclaimed jurisdictions, or only some? Legal opinion missing.
6. Wrangler CF API token rotation cadence and ownership — single key, never rotated?
7. `cron_run_log` / `usage_events` / `lifecycle_email_log` actual D1 row counts in prod — any of them >100k? (would tip backup truncation).
