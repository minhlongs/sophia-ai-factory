# Sophia AI Factory — Client Handover Package
# Gói Bàn Giao Khách Hàng — Sophia AI Factory

> **Status:** Production live at https://sophia.agencyos.network
> **Doctrine:** v1.28.1 — no-code/no-tech RaaS, BYOK customer-side, operator manages PLATFORM only
> **Honest score (audit-corrected):** **78/100** as of 2026-05-18 (pre Phase 06/07/08).
> **Target post Phase 06-10:** ~89-92/100 (Phase 06 pen test + Phase 07 DR drill + Phase 08 load test feed measured metrics in).
> **Audit reference:** [plans/reports/standardization-audit-260518-0308-sophia.md](../plans/reports/standardization-audit-260518-0308-sophia.md)
> **Generated:** 2026-05-18 (v1 — placeholders for Phase 06/07/08 metrics — refresh after those phases land)

---

## Table of Contents / Mục Lục

1. [What You're Getting / Bạn Nhận Được](#1-what-youre-getting--bạn-nhận-được)
2. [Quick Start / Khởi Đầu Nhanh](#2-quick-start--khởi-đầu-nhanh)
3. [Deploy Procedure / Quy Trình Deploy](#3-deploy-procedure--quy-trình-deploy)
4. [Disaster Recovery / Phục Hồi Sự Cố](#4-disaster-recovery--phục-hồi-sự-cố)
5. [Standard Operating Procedures / SOP Vận Hành](#5-standard-operating-procedures--sop-vận-hành)
6. [Incident Response / Ứng Phó Sự Cố](#6-incident-response--ứng-phó-sự-cố)
7. [Escalation Contacts / Liên Hệ Cấp Cao](#7-escalation-contacts--liên-hệ-cấp-cao)
8. [NOWPayments Management / Quản Lý NOWPayments](#8-nowpayments-management--quản-lý-nowpayments)
9. [Cloudflare Dashboard Access / Truy Cập Cloudflare](#9-cloudflare-dashboard-access--truy-cập-cloudflare)
10. [Known Limitations / Hạn Chế Đã Biết](#10-known-limitations--hạn-chế-đã-biết)
11. [Security & Compliance / Bảo Mật & Tuân Thủ](#11-security--compliance--bảo-mật--tuân-thủ)
12. [Reference Docs / Tài Liệu Tham Khảo](#12-reference-docs--tài-liệu-tham-khảo)

---

## 1. What You're Getting / Bạn Nhận Được

- 🚀 **Production-ready Next.js 16** + Cloudflare Workers + D1 + Better Auth + NOWPayments (USDT crypto)
- 🧪 **4,457 tests passing** / 32 skipped / 0 failures (as of 2026-05-18)
- 🧹 **ESLint: 0 errors, 341 warnings** (baseline `--max-warnings=341`)
- 🔒 **Pen test status:** Phase 06 pending — TBD after staging deploy completes
- 💾 **DR drill status:** Phase 07 pending — TBD RTO/RPO
- ⚡ **Load test status:** Phase 08 pending — TBD p95 @ 100 concurrent
- 🎟️ **FREE100-XXXX bulk-code system** with admin UI + CSV export ([Phase 03 endpoint](../src/app/api/admin/promo-codes/bulk-generate/route.ts) + [Phase 04a UI](<../src/app/[locale]/(admin)/admin/promo-codes/bulk/>))
- 📊 **20+ dashboard routes** (campaigns, billing, handover, BYOK, analytics, missions, experiments, etc.)
- 🌐 **Bilingual VI + EN** via next-intl (1,097 translation keys, full parity)
- 📦 **Repo foundations:** LICENSE (Proprietary) + [SECURITY.md](../../../SECURITY.md) + GitHub PR/Issue templates + CODEOWNERS

> 💬 **Doctrine note:** Per [sophia-no-tech-doctrine.md](../.claude/rules/sophia-no-tech-doctrine.md), this platform expects customers to self-input all third-party API keys (OpenRouter, ElevenLabs, D-ID, NOWPayments, affiliate networks, Telegram bot token) via the in-app Setup Wizard. **You as the operator do NOT need to provide any third-party credentials beyond your own Cloudflare account.**

---

## 2. Quick Start / Khởi Đầu Nhanh

1. **Clone canonical repo** (already done) → `~/projects/sophia-ai-factory/`
2. **Install dependencies** → `cd apps/sophia-ai-factory && npm install`
3. **Sign in to Cloudflare via wrangler** → `npx wrangler whoami` should return your account
4. **Deploy a no-op change** → see [§3](#3-deploy-procedure--quy-trình-deploy)
5. **Verify** → `curl -s https://sophia.agencyos.network/api/version | jq .shortSha` should match local `git rev-parse HEAD | cut -c1-8`
6. **Read** → [README.md](../../../README.md), [CONTRIBUTING.md](../CONTRIBUTING.md), [CLAUDE.md](../CLAUDE.md), and this package

---

## 3. Deploy Procedure / Quy Trình Deploy

📖 **Full guide:** [deployment-guide.md](deployment-guide.md) + [GO-LIVE-DEPLOYMENT-GUIDE.md](GO-LIVE-DEPLOYMENT-GUIDE.md)

### Quick reference (3 commands)
```bash
# 1. Push to origin (deploy script REJECTS unpushed commits)
git push origin main

# 2. Deploy via wrangler CLI (CF-direct, GitHub Actions disabled by design)
cd apps/sophia-ai-factory
npm run deploy:full

# 3. Verify SHA match — HTTP 200 alone is NOT sufficient (may be stale)
LOCAL=$(git rev-parse HEAD | cut -c1-8)
LIVE=$(curl -s https://sophia.agencyos.network/api/version | jq -r .shortSha)
[ "$LOCAL" = "$LIVE" ] && echo "✅ DEPLOY MATCHES" || echo "❌ STALE"
```

### Apply D1 migrations (if any added in commit)
```bash
bash scripts/apply-migrations.sh   # OR: npm run deploy:migrations
```

### Deploy verification rule (MANDATORY)
See [.claude/rules/sophia-deploy-verify.md](../.claude/rules/sophia-deploy-verify.md). Do **not** report "deployed" until SHA match passes.

### Staging environment
See [staging-environment.md](staging-environment.md). Staging at `https://sophia-ai-factory-staging.agencyos-openclaw.workers.dev` (deploy via `npm run deploy:staging`).

---

## 4. Disaster Recovery / Phục Hồi Sự Cố

📖 **Full procedure:** [disaster-recovery.md](disaster-recovery.md)

- **Backup strategy:** R2 lifecycle 30-day retention on `sophia-backups` bucket (de-facto backup per doctrine — no external cron required)
- **Measured RTO/RPO:** _TBD after Phase 07 DR drill executes_ — `dr-drill-260522.md` to be created
- **Restore command:** `wrangler d1 execute sophia-raas-db --file=<dump.sql> --remote`

---

## 5. Standard Operating Procedures / SOP Vận Hành

📖 **Full SOPs 1-13:** [dev-sops.md](dev-sops.md)

| SOP | Purpose |
|---|---|
| 1 | Local dev environment setup |
| 2 | Branch + commit conventions |
| 3 | Pre-push hook gates (G1-G5) |
| 4 | CF-direct deploy via wrangler |
| 5 | D1 migrations apply |
| 6 | Secrets rotation (see §8 for NOWPayments specifically) |
| 7 | i18n key sync (Rule 8) |
| 8 | Test discipline (auth gate + happy + error per route) |
| 9 | Rollback via `wrangler rollback` |
| 10 | Backup verification |
| 11 | Manual D1 backup trigger (no-tech doctrine: no external cron) |
| 12 | Wrangler tail debugging |
| 13 | Migration coverage guard |

**Smoke test walkthrough:** [operator-playbook/smoke-test-walkthrough.md](operator-playbook/smoke-test-walkthrough.md)

---

## 6. Incident Response / Ứng Phó Sự Cố

📖 **Playbook:** [incident-response-playbook.md](incident-response-playbook.md)

Quick reference:
- **P0** Critical (prod down / data loss / payment broken) → first response 15 min
- **P1** High (major feature broken / HIGH security vuln) → 1h
- **P2** Medium → 4h business hours
- **P3** Low → next business day

---

## 7. Escalation Contacts / Liên Hệ Cấp Cao

📖 **Full list:** [escalation-contacts.md](escalation-contacts.md)

> **No NDA / SLA / IP clauses** — internal/friendly handover. Add commercial terms here if engagement transitions to external commercial.

---

## 8. NOWPayments Management / Quản Lý NOWPayments

- **Admin console:** https://account.nowpayments.io
- **Key rotation procedure:** [nowpayments-key-rotation.md](nowpayments-key-rotation.md)
- **Required CF Worker secrets:** `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET`, `NOWPAYMENTS_WALLET`
- **Webhook endpoint:** `https://sophia.agencyos.network/api/webhooks/nowpayments` (HMAC-signed via IPN_SECRET)
- ❌ **DO NOT use Polar.sh** — rejected for this product per doctrine v1.28.1
- ❌ **DO NOT use PayPal** — banned
- ⚙️ **Backup provider:** PayOS for Vietnam domestic (if wired)

---

## 9. Cloudflare Dashboard Access / Truy Cập Cloudflare

- **Dashboard URL:** https://dash.cloudflare.com
- **Account:** `f691e83094f776311a1bfe3f8b126f1c` (Billwill.mentor@gmail.com)
- **Workers.dev subdomain:** `agencyos-openclaw`

### Resources
| Resource | Name | Purpose |
|---|---|---|
| Worker (PROD) | `sophia-ai-factory` | Main app |
| Worker (staging) | `sophia-ai-factory-staging` | Pen test / load test / DR drill |
| D1 (PROD) | `sophia-raas-db` (`78bd1961-…`) | App database |
| D1 (tag-cache PROD) | `sophia-tag-cache` (`7b1d4fd4-…`) | Next.js incremental cache |
| D1 (staging) | `sophia-raas-db-staging` (`bf74b301-…`) | Pen/load/DR target |
| D1 (tag-cache staging) | `sophia-tag-cache-staging` (`46da1446-…`) | Staging cache |
| R2 | `sophia-ai-factory-opennext-cache` | Next.js asset cache |
| R2 | `sophia-videos` | Video output storage |
| R2 | `sophia-backups` | D1 dumps + 30-day lifecycle |
| R2 | `sophia-staging-cache` | Staging Next.js cache |
| R2 | `sophia-videos-staging` | Staging video bucket (empty) |
| KV | `EXPERIMENT_KV` (`c3857792…`) | A/B variants — shared PROD+staging |

📖 **Wrangler CLI auth:** `npx wrangler whoami` — must return account ID above before any deploy.

---

## 10. Known Limitations / Hạn Chế Đã Biết

📖 **Full list:** [known-issues.md](known-issues.md) (P0/P1/P2/P3 triage)

### Doctrine-defined out-of-scope (intentional)
Per [sophia-no-tech-doctrine.md](../.claude/rules/sophia-no-tech-doctrine.md):
- No operator-side third-party setup (QStash crons, Sentry sourcemap tokens, observability tokens)
- Score ceiling under doctrine: **87.5/100**
- Going beyond requires operational track record (months of DR drills + monthly restore tests), not infra
- DMARC graduation `p=quarantine`: operator discretion, not platform requirement

### Outstanding architectural debt (deferred to standalone sprints)
- `tree/handover → forest/handover` migration (M5, ~20 callers — Batch B deferred)
- `tree/telegram → forest/telegram` migration (M6, ~14 callers — Batch B deferred)
- `raas-service` lowercase Tier unification (M7 — wire format conflict with `LICENSE_KEY_PATTERN`)

### P1 bulk-generate carryovers (Phase 03b)
- `Idempotency-Key` header not honored
- Sequential N=1000 ~10s vs NFR p95<3s
- Partial-write window (no D1 multi-statement tx)

---

## 11. Security & Compliance / Bảo Mật & Tuân Thủ

📖 **Vuln disclosure:** [SECURITY.md](../../../SECURITY.md)

| Report | Status |
|---|---|
| Pen test Part A (automated + auth/promo + ASVS L2 V2-V5) | _Phase 06 pending — see plans/_ |
| Pen test Part B (billing + privilege escalation + remediation) | _Phase 06 pending_ |
| ASVS L2 final compliance | _Phase 06 pending_ |
| DR drill (measured RTO/RPO) | _Phase 07 pending_ |
| Load test (k6 100 VU, p95 latency) | _Phase 08 pending_ |
| Standardization audit | ✅ [standardization-audit-260518-0308-sophia.md](../plans/reports/standardization-audit-260518-0308-sophia.md) (78/100) |
| Phase 04a code review | ✅ [code-review-260518-0302-phase-04a.md](../plans/260517-2223-sophia-free100-handover/reports/code-review-260518-0302-phase-04a.md) (9.6/10) |
| Phase 03 code review | ✅ [code-review-260518-0246-phase-03.md](../plans/260517-2223-sophia-free100-handover/reports/code-review-260518-0246-phase-03.md) (9.6/10) |
| Phase 01 audit | ✅ [phase-01-audit-report.md](../plans/260517-2223-sophia-free100-handover/reports/phase-01-audit-report.md) |

> 🔄 **Refresh schedule:** rebuild this section after Phases 06/07/08 ship measurable artifacts.

---

## 12. Reference Docs / Tài Liệu Tham Khảo

### Project canon
- [README.md](../../../README.md) — repo overview
- [CONTRIBUTING.md](../CONTRIBUTING.md) — contribution guidelines
- [SECURITY.md](../../../SECURITY.md) — vuln disclosure policy
- [LICENSE](../../../LICENSE) — Proprietary
- [CLAUDE.md](../CLAUDE.md) — Sophia AI agent rules

### Architecture & doctrine
- [sophia-no-tech-doctrine.md](../.claude/rules/sophia-no-tech-doctrine.md) v1.28.1
- [sophia-layer-architecture.md](../.claude/rules/sophia-layer-architecture.md) — 4-layer arch
- [cross-layer-orchestration.md](../.claude/rules/cross-layer-orchestration.md) — import direction rules
- [sophia-deploy-verify.md](../.claude/rules/sophia-deploy-verify.md) — SHA-match deploy verify
- [sophia-handover-rules.md](../../../.claude/rules/sophia-handover-rules.md) — client-facing rules (repo-level)

### Operations
- [deployment-guide.md](deployment-guide.md)
- [GO-LIVE-DEPLOYMENT-GUIDE.md](GO-LIVE-DEPLOYMENT-GUIDE.md)
- [disaster-recovery.md](disaster-recovery.md)
- [staging-environment.md](staging-environment.md)
- [dev-sops.md](dev-sops.md)
- [operator-playbook/smoke-test-walkthrough.md](operator-playbook/smoke-test-walkthrough.md)
- [incident-response-playbook.md](incident-response-playbook.md)
- [escalation-contacts.md](escalation-contacts.md)
- [nowpayments-key-rotation.md](nowpayments-key-rotation.md)
- [load-testing-runbook.md](load-testing-runbook.md)

### Plan + reports
- Active plan: `plans/260517-2223-sophia-free100-handover/`
- Audit report: `plans/reports/standardization-audit-260518-0308-sophia.md`
- Code reviews: `plans/260517-2223-sophia-free100-handover/reports/code-review-*.md`

---

## Sign-off / Xác Nhận Bàn Giao

By accepting this package, the recipient acknowledges:
- ✅ Read the full [doctrine](../.claude/rules/sophia-no-tech-doctrine.md) v1.28.1 — customer BYOK is non-negotiable
- ✅ Understands score ceiling 87.5 under doctrine and what's needed to lift it (operational track record)
- ✅ Has Cloudflare account access + wrangler CLI authenticated (`npx wrangler whoami` returns account `f691e83094f776311a1bfe3f8b126f1c`)
- ✅ Has access to escalation contacts and the incident playbook
- ✅ Reviewed known limitations and the deferred architectural debt items
- ✅ Reviewed pen test / DR drill / load test status (or accepts the pending Phase 06-08 deliverables)

**Operator signature / Người Bàn Giao:** _______________________
**Recipient signature / Người Nhận:** _______________________
**Date / Ngày:** _______________________
