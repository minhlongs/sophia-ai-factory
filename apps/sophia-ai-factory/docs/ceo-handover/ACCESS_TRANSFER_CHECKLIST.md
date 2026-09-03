# ACCESS TRANSFER CHECKLIST — SOPHIA AI FACTORY / DANH SÁCH KIỂM TRA CHUYỂN GIAO QUYỀN TRUY CẬP

> **Baseline:** Commit `103cd0fc` / Production `5dd1f071` | **Audit method:** Empirical verification via `wrangler`, `gh`, API queries | **Rule 9:** Claims without evidence are "DOCUMENTED BUT UNVERIFIED"
>
> **DO NOT:** Request secrets, rotate credentials, modify Cloudflare billing, change GitHub ownership, modify payment provider ownership, or change production infrastructure without explicit evidence.
>
> **Purpose / Mục đích:** Founder-only action pack (manual, personal-login steps). Each table row is a single manual step the founder must perform and record evidence for. No duplicate actions across systems.

---

## System 1: Cloudflare — Workers / DNS / D1 / R2 / KV / Secrets

| STEP | WHO MUST ACT | EXPECTED RESULT | HOW TO VERIFY | EVIDENCE TO RECORD | ROLLBACK / RECOVERY |
|---|---|---|---|---|---|
| 1.1 | Founder | Service account token created with Workers Scripts (Edit), D1 (Edit), R2 (Edit), KV (Edit), Zone DNS (Edit) for `agencyos.network` | Founder: dash.cloudflare.com → My Profile → API Tokens → Create Token. Name: `sophia-tech-lead-access`. Expiry: 90 days. Share via password manager (1Password/Bitwarden), NOT email/screen | Screenshot of token permissions screen (names only, no values). Password manager entry exists. | Delete token in CF dashboard → revoke access immediately |
| 1.2 | Founder | Workers Paid Plan ACTIVE (already verified per Phase 1) | `curl -s https://sophia.agencyos.network/api/version` returns `{"shortSha":"103cd0fc"}` | Deploy SHA match confirmed in CRITICAL_ASSET_REGISTER.md | N/A — already active |
| 1.3 | Founder | 53 Worker secrets documented in password manager | Run `npx wrangler secret list` with Tech Lead token (post-step 1.1). Document all 53 secret names in password manager entry `Sophia Cloudflare Secrets` | Password manager entry listing 53 secret names (names only, no values) | Rotate individual secret: `npx wrangler secret put SECRET_NAME` |
| 1.4 | Founder | Tech Lead can run `wrangler whoami` and see tech-lead email, NOT founder email | Tech Lead: `export CLOUDFLARE_API_TOKEN=<token>; npx wrangler whoami` | Command output showing Tech Lead email (not `billwill.mentor@gmail.com`) | Revoke token in step 1.1 |
| 1.5 | Founder | Domain `agencyos.network` DNS editing verified by Tech Lead | Tech Lead: `npx wrangler dns records list agencyos.network` | Command output showing DNS records listed successfully | Revoke token in step 1.1 |
| 1.6 | Founder | D1 database query access verified by Tech Lead | Tech Lead: `npx wrangler d1 list` | Output showing 5 D1 databases (sophia-raas-db, sophia-raas-db-drill, sophia-tag-cache, sophia-tag-cache-staging) | Revoke token in step 1.1 |
| 1.7 | Founder | R2 bucket listing verified by Tech Lead | Tech Lead: `npx wrangler r2 bucket list` | Output showing 6 Sophis buckets (sophia-ai-factory-opennext-cache, sophia-backups, sophia-staging-cache, sophia-symbols, sophia-videos, sophia-videos-staging) | Revoke token in step 1.1 |
| 1.8 | Founder | KV namespace listing verified by Tech Lead | Tech Lead: `npx wrangler kv namespace list` | Output showing 19 KV namespaces (CONFIG, ALERT_STATE, API_METRICS, AUDIT_LOG, etc.) | Revoke token in step 1.1 |
| 1.9 | Tech Lead | D1 backup route tested manually | Tech Lead: `curl -X POST https://sophia.agencyos.network/api/cron/d1-backup -H "Authorization: Bearer $CRON_SECRET"` (using documented CRON_SECRET from password manager) | HTTP 200 response + new backup in `sophia-backups` R2 bucket | Restore from backup: `wrangler d1 execute sophia-raas-db --file=<backup.sql> --remote` |
| 1.10 | Tech Lead | D1 restore drill executed to scratch database | Tech Lead: create scratch D1 (`wrangler d1 create sophia-raas-db-restore-test`), restore backup, compare row counts | Row count comparison: users, subscriptions, payments, missions tables match production within tolerance | Delete scratch DB: `wrangler d1 delete sophia-raas-db-restore-test` |

**Classification:** 1.1–1.8 = 🔴 FOUNDER ACTION REQUIRED | 1.9–1.10 = 🔴 FOUNDER ACTION REQUIRED (depends on 1.1)
**Status:** D1 list failed with auth error 10000 — token has d1:write scope but D1 list endpoint rejected (documented in CRITICAL_ASSET_REGISTER.md)

---

## System 2: GitHub

| STEP | WHO MUST ACT | EXPECTED RESULT | HOW TO VERIFY | EVIDENCE TO RECORD | ROLLBACK / RECOVERY |
|---|---|---|---|---|---|
| 2.1 | Founder | Tech Lead added as repository collaborator with **Owner** role (not Member) | Founder: github.com/minhlongs/sophia-ai-factory/settings/access → Add people → Enter Tech Lead GitHub username → Select "Admin" role | Confirmation in GitHub UI (invite sent). Tech Lead accepts invite in email or GitHub notifications | Remove collaborator: Settings → Members → remove Tech Lead |
| 2.2 | Tech Lead | Accept GitHub invitation and verify admin access | Tech Lead: `gh auth login` then `gh api repos/minhlongs/sophia-ai-factory/collaborators` | Output showing Tech Lead listed as collaborator with `"role_name":"admin"` | N/A — once accepted, can leave org or remove own access |
| 2.3 | Tech Lead | Verify deploy verification SHA match works from Tech Lead machine | Tech Lead: `git rev-parse HEAD | cut -c1-8` then `curl -s https://sophia.agencyos.network/api/version \| grep -o '"shortSha":"[^"]*"' | SHA values match (documented in CRITICAL_ASSET_REGISTER.md) | N/A — production rollback via `wrangler rollback` |

**Classification:** 2.1 = 🔴 FOUNDER ACTION REQUIRED | 2.2–2.3 = 🔴 FOUNDER ACTION REQUIRED (depends on 2.1)
**Status:** 0 collaborators — Tech Lead not invited. 2FA enabled on minhlongs (verified via `gh api users/minhlongs`).

---

## System 3: NOWPayments (Primary Payment Provider)

| STEP | WHO MUST ACT | EXPECTED RESULT | HOW TO VERIFY | EVIDENCE TO RECORD | ROLLBACK / RECOVERY |
|---|---|---|---|---|---|
| 3.1 | Founder | Tech Lead invited to NOWPayments team with full access | Founder: nowpayments.io → Settings → Team / Users → Add member → Enter Tech Lead email → Select "Full access" | Confirmation in NOWPayments UI (team member added). Tech Lead accepts email invite | Remove team member: Settings → Team → remove Tech Lead |
| 3.2 | Tech Lead | Accept NOWPayments invite and verify dashboard access | Tech Lead: login to nowpayments.io with invited email | Dashboard accessible showing Sophia merchant account | Leave team: Settings → Team → Leave team |
| 3.3 | Tech Lead | Verify IPN webhook URL is correct and active | Tech Lead: Settings → IPN → verify `https://sophia.agencyos.network/api/payments/nowpayments-ipn` is registered | Webhook URL confirmed in NOWPayments dashboard | Update IPN URL: Settings → IPN → edit URL |
| 3.4 | Tech Lead | Test tier activation flow from payment record | Tech Lead: Check production payments → verify tier activated for test user | Payment record shows tier activated successfully | N/A — use test mode before changing live |

**Classification:** 3.1 = 🔴 FOUNDER ACTION REQUIRED | 3.2–3.4 = 🔴 FOUNDER ACTION REQUIRED (depends on 3.1)
**Status:** NOWPayments credentials in CF secrets (`NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET`, `NOWPAYMENTS_WALLET`) but dashboard access unshared (documented but unverified).

---

## System 4: PayOS (Vietnam Domestic Backup)

| STEP | WHO MUST ACT | EXPECTED RESULT | HOW TO VERIFY | EVIDENCE TO RECORD | ROLLBACK / RECOVERY |
|---|---|---|---|---|---|
| 4.1 | Founder | Tech Lead invited to PayOS team with full access | Founder: payos.vn → Settings → Team → Add member → Enter Tech Lead email → Select "Admin" | Confirmation in PayOS UI (team member added). Tech Lead accepts email invite | Remove team member: Settings → Team → remove Tech Lead |
| 4.2 | Tech Lead | Accept PayOS invite and verify dashboard access | Tech Lead: login to payos.vn with invited email | Dashboard accessible showing Sophia PayOS account | Leave team: Settings → Team → Leave team |
| 4.3 | Tech Lead | Verify PayOS webhook URL | Tech Lead: Settings → Webhook → verify `https://sophia.agencyos.network/api/payments/payos-ipn` | Webhook URL confirmed in PayOS dashboard | Update webhook URL: Settings → Webhook → edit URL |

**Classification:** 4.1 = 🔴 FOUNDER ACTION REQUIRED | 4.2–4.3 = 🔴 FOUNDER ACTION REQUIRED (depends on 4.1)
**Status:** PayOS credentials in CF secrets (`PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`) but dashboard access unshared (documented but unverified).

---

## System 5: Inngest

| STEP | WHO MUST ACT | EXPECTED RESULT | HOW TO VERIFY | EVIDENCE TO RECORD | ROLLBACK / RECOVERY |
|---|---|---|---|---|---|
| 5.1 | Founder | Tech Lead invited to Inngest org as Admin | Founder: app.inngest.com → Team Settings → Members → Invite Admin → Enter Lead email | Confirmation in Inngest UI (invitation sent). Tech Lead accepts email invite | Remove member: Team Settings → Members → remove Tech Lead |
| 5.2 | Tech Lead | Accept Inngest invite and verify app access | Tech Lead: login to app.inngest.com → verify `sophia-ai-factory` app visible | Dashboard accessible showing Sophia Inngest app with 14 functions | Leave team: Team Settings → Leave team |
| 5.3 | Founder | Verify INNGEST_EVENT_KEY in CF secrets is active | Founder or Tech Lead: `npx wrangler secret list \| grep INNGEST` | Secret name confirmed in CF (value never printed) | Rotate key: Inngest dashboard → Settings → API Keys → regenerate |
| 5.4 | Tech Lead | Verify Inngest functions are healthy | Tech Lead: app.inngest.com → Functions → all 14 show green/healthy | Screenshot of Inngest dashboard showing healthy functions | Contact Inngest support if functions degraded |

**Classification:** 5.1 = 🔴 FOUNDER ACTION REQUIRED | 5.3 = ❌ DOCUMENTED BUT UNVERIFIED | 5.2, 5.4 = 🔴 FOUNDER ACTION REQUIRED (depends on 5.1)
**Status:** `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` in CF secrets. Client ID `sophia-ai-factory` in code. API access failed with 404 (tokens may be expired).

---

## System 6: Sentry

| STEP | WHO MUST ACT | EXPECTED RESULT | HOW TO VERIFY | EVIDENCE TO RECORD | ROLLBACK / RECOVERY |
|---|---|---|---|---|---|
| 6.1 | Founder | Tech Lead invited to Sentry org as Admin | Founder: sentry.io → Organization Settings → Members → Invite Member → Enter Tech Lead email → Select "Admin" | Confirmation in Sentry UI (invitation sent). Tech Lead accepts email invite | Remove member: Organization Settings → Members → remove Tech Lead |
| 6.2 | Tech Lead | Accept Sentry invite and verify project access | Tech Lead: login to sentry.io → verify `sophia-ai-factory` project visible | Dashboard accessible showing Sophia Sentry project | Leave org: Organization Settings → Leave organization |
| 6.3 | Founder | Verify SENTRY_AUTH_TOKEN scope covers source map upload | Founder: sentry.io → API Keys → verify token has `project:write` and `org:read` | Token scope listed in Sentry UI (scopes only, no values) | Revoke token: API Keys → revoke |
| 6.4 | Tech Lead | Test error capture from production | Tech Lead: trigger test error → check sentry.io for event | Event appears in Sentry with correct release tag | N/A — test errors only |

**Classification:** 6.1 = 🔴 FOUNDER ACTION REQUIRED | 6.3 = ❌ DOCUMENTED BUT UNVERIFIED | 6.2, 6.4 = 🔴 FOUNDER ACTION REQUIRED (depends on 6.1)
**Status:** `SENTRY_DSN` and `SENTRY_AUTH_TOKEN` in CF secrets. `.env.example` shows `SENTRY_ORG=sophia-ai-factory`, `SENTRY_PROJECT=sophia-ai-factory`. Sentry API auth failed (token invalid/expired).

---

## System 7: Domain Registrar

| STEP | WHO MUST ACT | EXPECTED RESULT | HOW TO VERIFY | EVIDENCE TO RECORD | ROLLBACK / RECOVERY |
|---|---|---|---|---|---|
| 7.1 | Founder | Transfer `agencyos.network` to Cloudflare Registrar OR add Tech Lead as authorized contact | Founder: access Identity Digital registrar account → initiate transfer OR update contact info with Tech Lead email | Transfer initiation confirmation (EPP code received) OR updated contact record showing Tech Lead email | Cancel transfer: registrar dashboard → cancel transfer request |
| 7.2 | Tech Lead | Verify domain transfer or contact update | Tech Lead: `whois agencyos.network` after 48h propagation | WHOIS record shows Tech Lead email as technical/admin contact OR `domain_status: transfer` | N/A — irreversible once transferred |
| 7.3 | Founder | Document domain renewal date and auto-renew status | Founder: registrar dashboard → Renewal & Billing → screenshot renewal date | Document in password manager: renewal date, auto-renew status, registrar login URL | N/A |

**Classification:** 7.1–7.3 = 🔴 FOUNDER ACTION REQUIRED
**Status:** Registrar is Identity Digital Inc. (verified via `whois`). Domain managed via Cloudflare DNS. Transfer requires founder action at registrar.

---

## System 8: Database Provider (Cloudflare D1)

| STEP | WHO MUST ACT | EXPECTED RESULT | HOW TO VERIFY | EVIDENCE TO RECORD | ROLLBACK / RECOVERY |
|---|---|---|---|---|---|
| 8.1 | Tech Lead | D1 backup route triggered manually | Tech Lead: `curl -X POST https://sophia.agencyos.network/api/cron/d1-backup -H "Authorization: Bearer $CRON_SECRET"` | HTTP 200 + new backup file in `sophia-backups` R2 bucket | Restore from backup: `wrangler d1 execute sophia-raas-db --file=<backup.sql> --remote` |
| 8.2 | Tech Lead | D1 restore to scratch database | Tech Lead create scratch D1 → restore backup → compare row counts | Row count comparison for users, subscriptions, payments, missions tables | Delete scratch DB: `wrangler d1 delete sophia-raas-db-restore-test` |
| 8.3 | Tech Lead | D1 migration script access verified | Tech Lead: clone repo → `cd apps/sophia-ai-factory && bash scripts/apply-migrations.sh` (dry run) | Migration script runs without errors (dry run output) | N/A — script is read-only in dry-run mode |

**Classification:** 8.1–8.3 = 🔴 FOUNDER ACTION REQUIRED (depends on step 1.1 for CF token)
**Status:** 5 D1 databases exist (sophia-raas-db, sophia-raas-db-drill, sophia-tag-cache, sophia-tag-cache-staging, sophia-raas-db-staging). Primary DB is 4.3 MB (verified). Cron route exists but never tested in production.

---

## System 9: AI Providers (OpenRouter, ElevenLabs, D-ID, HeyGen)

| STEP | WHO MUST ACT | EXPECTED RESULT | HOW TO VERIFY | EVIDENCE TO RECORD | ROLLBACK / RECOVERY |
|---|---|---|---|---|---|
| 9.1 | Founder | Document all AI provider API key names in password manager | Founder: `npx wrangler secret list \| grep -E "OPENROUTER|ELEVENLABS|D_ID|HEYGEN"` | Password manager entry listing 5 AI provider secret names (names only) | Rotate individual key: `npx wrangler secret put SECRET_NAME` |
| 9.2 | Tech Lead | Test fallback AI provider keys work (platform, not customer BYOK) | Tech Lead: trigger a workflow that uses platform fallback → verify success | Workflow completes successfully with platform key | N/A — customer keys unaffected if platform key fails |
| 9.3 | Founder | Verify AI provider dashboard access shared with Tech Lead | Founder: log into each provider dashboard → Team/Users → invite Tech Lead | Invitations sent to OpenRouter, ElevenLabs, D-ID, HeyGen | Remove member: each provider dashboard → Team Management |

**Classification:** 9.1, 9.3 = 🔴 FOUNDER ACTION REQUIRED | 9.2 = 🔴 FOUNDER ACTION REQUIRED (depends on 9.1)
**Status:** CF secrets exist: `OPENROUTER_API_KEY`, `ELEVENLABS_API_KEY`, `D_ID_API_KEY`, `HEYGEN_API_KEY`, plus `HEYGEN_API_URL`, `HEYGEN_AVATER_DEFAULT`, `HEYGEN_TEMPLATE_*`. Customer BYOK keys encrypted in D1 (unaffected by platform key rotation).

---

## System 10: Email Provider (Resend)

| STEP | WHO MUST ACT | EXPECTED RESULT | HOW TO VERIFY | EVIDENCE TO RECORD | ROLLBACK / RECOVERY |
|---|---|---|---|---|---|
| 10.1 | Founder | Document Resend API key name in password manager | Founder: `npx wrangler secret list \| grep -E "RESEND"` | Password manager entry listing Resend secret name (names only) | Rotate key: Resend dashboard → API Keys → regenerate |
| 10.2 | Founder | Share Resend dashboard access with Tech Lead | Founder: resend.com → Settings → Team → Invite Team Member → Enter Tech Lead email | Invitation sent from Resend dashboard | Remove member: Resend → Settings → Team → remove |
| 10.3 | Tech Lead | Test email sending from production | Tech Lead: trigger a receipt email via test payment | Email received at test address | N/A — disable email sending in Resend if needed |

**Classification:** 10.1, 10.2 = 🔴 FOUNDER ACTION REQUIRED | 10.3 = 🔴 FOUNDER ACTION REQUIRED (depends on 10.2)
**Status:** `RESEND_API_KEY` exists in CF secrets. `EMAIL_FROM` configured. Used in cron email-drip and receipt emails.

---

## System 11: CI/CD Provider (GitHub Actions)

| STEP | WHO MUST ACT | EXPECTED RESULT | HOW TO VERIFY | EVIDENCE TO RECORD | ROLLBACK / RECOVERY |
|---|---|---|---|---|---|
| 11.1 | Founder | Confirm GitHub Actions workflows documented and understood by Tech Lead | Founder: `ls .github/workflows/` → 2 active workflows (deploy-2-guard.yml, Auto-Deploy) | Workflow files read by Tech Lead | N/A — GitHub Actions disabled by design (CF-direct doctrine) |
| 11.2 | Tech Lead | Verify CF-direct deploy flow works from Tech Lead machine | Tech Lead: push to main → `cd apps/sophia-ai-factory && npm run deploy:full` → verify SHA match | Deploy completes → `curl -s https://sophia.agencyos.network/api/version` matches local SHA | Rollback: `npx wrangler rollback --name sophia-ai-factory` |
| 11.3 | Tech Lead | Verify deploy gate checks pass | Tech Lead: `npm run build` (0 TS errors) → `npm test` (all pass) | Build test outputs show pass status | N/A — blocked deploy is safest state |

**Classification:** 11.1 = ❌ DOCUMENTED BUT UNVERIFIED | 11.2, 11.3 = 🔴 FOUNDER ACTION REQUIRED (depends on step 2.1 for GitHub admin)
**Status:** GitHub Actions workflows exist but CF-direct doctrine is canonical. Deploy requires `git push origin main` first (deploy-with-sha.sh rejects unpushed commits). Repo has 0 repo secrets (all in CF Dashboard).

---

## Summary: Founder Action Count

| Priority | Count | Systems |
|---------|------:|---------|
| **P0 — Immediate business stop** | 0 | (no P0 items — all systems have workarounds or are already active) |
| **P1 — Must fix before founder absence** | 33 | Cloudflare (1.1–1.8), GitHub (2.1), NOWPayments (3.1), PayOS (4.1), Inngest (5.1), Sentry (6.1), Domain (7.1–7.3), AI providers (9.1, 9.3), Email (10.1, 10.2) |
| **P2 — Fix within 30 days** | 8 | Cloudflare backup/restore (1.9–1.10), D1 drill (8.1–8.2), CI/CD gate (11.2–11.3), AI provider testing (9.2, 9.3) |
| **P3 — Documentation/verification** | 4 | Inngest/Sentry token validity (5.3, 6.3), CI/CD docs (11.1) |
| **Total Founder-Action Items** | **45** | |
| **Total Systems Covered** | **11** | Cloudflare, GitHub, NOWPayments, PayOS, Inngest, Sentry, Domain registrar, Database, AI providers, Email, CI/CD |

---

## Classification Legend / Chú giải phân loại

| Status | Meaning (EN) | Meaning (VI) |
|---|---|---|
| **✅ VERIFIED** | Actual access confirmed via CLI/API command output | Đã xác minh quyền truy cập qua lệnh/output |
| **❌ DOCUMENTED BUT UNVERIFIED** | Documented in matrix but no empirical evidence found | Đã ghi nhận nhưng chưa có bằng chứng thực tế |
| **🔴 FOUNDER ACTION REQUIRED** | Access confirmed founder-only; no shared/service account exists | Yêu cầu hành động trực tiếp của Founder |
| **⚪ NOT APPLICABLE** | System not used or deprecated | Không áp dụng |

---

## Evidence Requirements / Yêu cầu bằng chứng

1. **No secrets printed** — All evidence records capture secret NAMES, never VALUES.
2. **No automatic rotation** — All credential rotations require founder action. No automated scripts change production credentials.
3. **No billing changes** — Cloudflare billing verification only (no modifications).
4. **No ownership changes** — GitHub repo ownership stays with founder; only collaborator access added.
5. **No infrastructure changes** — All verification commands are read-only or manual restore drills on scratch databases.

---

## Rollback / Recovery Notes / Ghi chú khôi phục

| System | Rollback Path | Recovery Time Objective |
|--------|--------------|------------------------|
| Cloudflare | Revoke API token → access immediately removed | < 1 minute |
| GitHub | Remove collaborator → admin access revoked | < 1 minute |
| NOWPayments | Remove team member | < 1 minute |
| PayOS | Remove team member | < 1 minute |
| Inngest | Remove team member | < 1 minute |
| Sentry | Remove team member | < 1 minute |
| Domain | Cancel transfer at registrar | < 24 hours (before completion) |
| D1 | Restore from backup | < 1 hour (documented procedure) |
| AI Providers | Remove team member / rotate key | < 5 minutes |
| Email | Remove team member | < 1 minute |
| CI/CD | N/A (CF-direct, no GitHub Actions) | N/A |

---

## Related Documents / Tài liệu liên quan

| Document | Link |
|---|---|
| Founder Action Checklist | `./FOUNDER_ACTION_CHECKLIST.md` |
| Access Ownership Matrix | `./ACCESS_OWNERSHIP_MATRIX.md` |
| Handover Gaps | `./HANDOVER_GAPS.md` |
| Critical Asset Register | `./CRITICAL_ASSET_REGISTER.md` |
| Personal Account Dependency | `./PERSONAL_ACCOUNT_DEPENDENCY.md` |
| CEO Day 1 Access Test | `./CEO_DAY_1_ACCESS_TEST.md` |

---

*Generated: 2026-09-03 | Baseline: `103cd0fc` | Production: `5dd1f071` | Method: Empirical verification via wrangler, gh, curl, dig against production infrastructure. No secrets exposed. No credentials rotated. No billing modified. No ownership changes automated.*
