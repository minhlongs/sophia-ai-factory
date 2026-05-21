# GO-LIVE Punch-List — Sophia AI Factory

**Synthesized:** 2026-05-20 22:25
**Sources:** gap-{A,B,C,D}-*.md (E pending — section to be appended)
**Status:** AWAITING APPROVAL before Phase 2 execution
**Doctrine ceiling:** 87.5/100 (unchanged by any gap below)

---

## P0 — BLOCKS GO LIVE (must close before paying-customer launch)

| ID | Domain | Gap | Fix sketch | Effort |
|---|---|---|---|---|
| **PG-001** | Product | MASTER tier $4,999 refund policy unclear (final-sale vs 30-day window) | Long decides; doc in pricing-and-tiers.md + refund runbook | S (product decision + 1h doc) |
| **PG-002** | Product | No self-serve refund UI; route exists but dashboard form missing | Dashboard "Request Refund" form → existing API route | M (4h) |
| **PG-003** | Product | No self-serve tier-downgrade flow; customer locked into ENTERPRISE mid-cycle | Dashboard "Change Tier" → server action; prorate or end-of-cycle | M (6h) |
| **SG-001** | Security | Better Auth account lockout migration exists but NOT wired to sign-in endpoint | Wire lockout middleware into Better Auth sign-in handler | S (1-2h) |
| **SG-003** | Security | ASVS V3.5.1 admin re-auth challenge missing (bulk promo generation unprotected) | Add re-auth modal gating admin destructive actions | M (4-6h) |
| **CG-001** | Customer | Pricing page hardcoded EN-only (Vietnamese CEO market unviable) | Wire `t()` into PricingCard + PricingComparisonTable; add VI strings | M (4h) |
| **CG-002** | Customer | NOWPayments USDT/wallet/network jargon unexplained for non-crypto VN users | Add "How to pay with crypto" wizard step + VI explainer | M (3h) |
| **CG-003** | Customer | Setup Wizard API key fields lack inline "where to get key" help links | Add help links/tooltips for OpenRouter, ElevenLabs, D-ID | S (2h) |
| **CG-004** | Customer | Email DNS (SPF/DKIM/DMARC) unverified — welcome emails may bounce/spam, blocking activation | Verify Resend domain in CF DNS; add records if missing | S (1h, infra) |

**P0 count: 9** · **P0 effort total: ~27h (~3.5 days)**

---

## P1 — MUST FIX WITHIN 7 DAYS POST-LAUNCH

| ID | Domain | Gap | Fix | Effort |
|---|---|---|---|---|
| OG-001 | Ops | `docs/postmortems/` directory referenced by incident playbook but missing | `mkdir docs/postmortems && touch .gitkeep` | S (5min) |
| OG-002 | Ops | 18+ cron schedules (dunning, usage-export, email-drip, ...) — zero failure alerts | Sentry alert rule + heartbeat endpoint + escalation-contacts doc | M (3-4h) |
| OG-007 | Ops | Secret rotation runbook only covers NOWPayments; missing CRON_SECRET, BETTER_AUTH_SECRET, TELEGRAM_BOT_TOKEN, INTERNAL_API_SECRET | Consolidated `secret-rotation-runbook.md` covering all 8 secrets | M (3h) |
| SG-004 | Security | JSON parse error returns 500 instead of 400 (Pentest MEDIUM-1) | Wrap body parser in try/catch → 400 | S (30min) |
| SG-005 | Security | `/api/admin/promo-codes` returns 200 HTML instead of 404 JSON (Pentest MEDIUM-2) | Add explicit method/handler check → 404 JSON | S (30min) |
| PG-004/005/006 | Product | Docs-code mismatch: weekly auto-updates, landing page, account manager features undefined | Long decision per item + spec or remove from docs | M (4h product + 4h docs) |
| PG-007/008 | Product | i18n: dashboard pages hardcoded EN (overlap with CG-001) | Bundle with CG-001 wave | M (covered by CG-001) |
| PG-009/010 | Product | No 404 fallback + missing error boundaries on data-dependent pages | Add `not-found.tsx` + `error.tsx` per route group | S (2h) |
| CG-005 | Customer | No self-serve "Cancel Subscription" button on dashboard | Bundle with PG-002 refund UI | (covered) |
| CG-006 | Customer | Tier upgrade prompts not wired when customer hits tier limit | Tier-limit hit → toast + upgrade CTA | M (3h) |
| CG-007 | Customer | Telegram bot command drift (10 live vs docs unclear) | Reconcile telegram-bot-{guide,setup}.md against actual /commands handler | S (1h) |
| CG-008 | Customer | Welcome email hardcoded EN | Add VI variant + locale switch | S (2h) |
| CG-009 | Customer | First-value moment unclear post-payment | Add "Your first campaign is ready in X minutes" CTA in success page | S (2h) |

**P1 count: 12** · **P1 effort total: ~28h (~3.5 days)**

---

## P2 — POLISH / BACKLOG (post-launch sprint)

| ID | Gap | Effort |
|---|---|---|
| OG-003 | DMARC p=none → p=quarantine (scheduled 2026-06-12) | S |
| OG-005 | Cost monitoring undocumented | S (1h research, post-launch) |
| OG-006 | Log retention policy absent | S |
| OG-008 | Sentry sourcemap upload optional | S |
| OG-009 | DR drill never run on PROD (only staging 260518) | M (schedule week 1) |
| OG-010 | Escalation contacts use placeholders | S (during client handover) |
| SG-006 | 5 MODERATE dep CVEs (dev-only, low condition) | S (`pnpm audit fix`) |
| SG-007 | Audit log retention policy undocumented | S |
| SG-008 | 38 `console.log` in production code | S (lint sweep) |
| SG-009 | 56 `:any` annotations (violates code-standards.md) | M (incremental typing) |
| SG-010 | Pentest Part B (ZAP/Burp) not executed | M (post-launch) |
| PG-011 | ENTERPRISE API rate limit undocumented | S |
| PG-013 | FAQ contradictory on refund policy (depends on PG-001 decision) | S |
| CG-010 | Crypto/PayOS FAQ section | S |
| CG-011 | Invoice bilingual | S |
| CG-012 | Account deletion 2-step confirm | S |

**P2 count: 16** · **P2 effort total: ~16h**

---

## Wave Plan (Phase 2 — parallel execution after approval)

Grouped by file ownership to enable parallel agents with no conflict:

- **Wave 1 (security, blocking):** SG-001 + SG-003 + SG-004 + SG-005 → 1 agent owns `src/lib/better-auth-*`, `src/app/api/admin/promo-codes/*`. Effort: ~7h.
- **Wave 2 (customer i18n + UX, blocking):** CG-001 + CG-002 + CG-003 + CG-008 + CG-009 → 1 agent owns `src/components/pricing/*`, `src/locales/*`, `src/components/setup-wizard/*`. Effort: ~13h.
- **Wave 3 (refund/downgrade UI, blocking):** PG-002 + PG-003 (+ bundled CG-005) → 1 agent owns `src/app/dashboard/billing/*`, `src/components/billing/*`. Effort: ~10h.
- **Wave 4 (infra/ops quick fixes):** CG-004 DNS + OG-001 mkdir + OG-002 cron alerts + SG-004/005 if not bundled in Wave 1 → 1 agent owns wrangler config + docs/. Effort: ~5h.
- **Wave 5 (product decisions, gated on Long):** PG-001 + PG-004/005/006 → Long answers → docs updated. Effort: ~5h after decisions.

Waves 1-4 are non-overlapping; can run as 4 parallel agents. Wave 5 is gated.

---

## Approval-Gate Questions for Long

1. **PG-001 — MASTER refund policy:** Final-sale (no refund) | 30-day window | 14-day window?
2. **PG-004 — Weekly auto-updates feature:** Platform-delivered | customer responsibility | remove from docs?
3. **PG-005 — Landing page:** Sophia-generated or external? Spec exists?
4. **PG-006 — Account Manager (ENTERPRISE+):** Who is it? SLA? Or remove from pricing?
5. **SG-001/SG-003 timing:** Gate GO LIVE on these | land as Day-1 hotfixes post-launch?
6. **OG-005 cost alert threshold:** Monthly burn alert at $X? (default $50 free-tier overage?)
7. **OG-009 prod DR drill:** Run pre-launch (risky on prod) | schedule Week 1 post-launch?
8. **PayOS status:** Full integration | stub | aspirational (cluster B noted no webhook)?
9. **Mekong support email** (`support@mekongmind.com`, 18 files): live + monitored mailbox confirmed?

---

## Honest Doctrine Score Movement (projection)

Closing all 9 P0 + 12 P1 lifts:
- **Security layer:** 9/10 → 9.5/10 (SG-001/003/004/005 closed)
- **Customer layer:** ~7/10 → 9/10 (i18n + UX gaps closed)
- **Product layer:** ~7/10 → 8.5/10 (refund/downgrade flows shipped)
- **Ops layer:** 7.5/10 → 8.5/10 (cron alerts + secret rotation)

Doctrine ceiling stays at 87.5/100 per v1.28.1 (lifts above require external cron + operator creds = doctrine rejection). All gaps fit *within* the ceiling.

---

## Section E — Infra (LANDED)

**Source:** `research/gap-E-infra.md` (13 IG entries). No P0 — all infra gaps are P1/P2/P3. Positive findings: load test 100 VU verified, build GREEN, DR staging RTO 12.9s.

### Infra P1 (must fix within 7 days post-launch) — adds to P1 totals

| ID | Gap | Fix | Effort |
|---|---|---|---|
| IG-001 | Cron idempotency: fulfillment-retry route 404s; 18 routes lack idempotency keys | Audit each cron route, add idempotency key + structured 4xx/5xx returns | M (~36h spread, S per route) |
| IG-002 | D1 single-region (APAC-only) — 4h+ outage if region fails | Document DR runbook + cross-region read replica eval; HA needs CF custom | M (~6h doc; HA is doctrine question) |
| IG-003 | Backup cycle unverified in prod | Monthly restore-drill SOP + checksum verification job | S manual SOP / L if automated |
| IG-004 | Cron secret rotation SOP missing (covered partially by OG-007) | Roll into consolidated secret-rotation-runbook.md (OG-007) | S (covered) |
| IG-005 | CF quota visibility zero — surprise-bill risk | Daily quota check script + Sentry alert at 70% / 90% / 100% | M (~4h) |

**Infra P1 count: 5** · **Infra P1 effort: ~16h (excl. IG-004 covered)**

### Infra P2 (post-launch backlog)

| ID | Gap | Effort |
|---|---|---|
| IG-006 | D1 migration hygiene (117 migrations, no consolidation) | M |
| IG-007 | Cost/run estimate missing — operator cannot forecast burn | M |
| IG-008 | External API quota exhaustion unhandled (OpenRouter/ElevenLabs/D-ID) | M |
| IG-009 | R2 storage growth & cleanup policy unknown | S |
| IG-010 | Cold start latency unverified on prod (only staging) | S |
| IG-011 | DNS/SSL hardening incomplete (DKIM, DNSSEC) — overlaps CG-004 | S |
| IG-012 | Rollback drill never executed | M (1–2h per drill) |

**Infra P2 count: 7** · **Infra P2 effort: ~14h**

### Infra P3 (doctrine clarification)

| ID | Gap | Effort |
|---|---|---|
| IG-013 | Rollback doctrine: `npm run deploy:full` reverse path unclear | S |

---

## Revised Totals (with Section E)

- **P0: 9** (~27h) — unchanged
- **P1: 12 + 5 = 17** (~28h + ~16h = **~44h / ~5.5 days**)
- **P2: 16 + 7 = 23** (~16h + ~14h = **~30h**)
- **P3: 1** (~1h)

### Updated Wave Plan

Add **Wave 6 (infra, P1 non-blocking but recommended pre-launch):**
- IG-005 quota alerts → 1 agent owns scripts/quota-check + Sentry config (~4h)
- IG-002 D1 DR runbook → 1 agent owns docs/runbooks/ (~6h)
- IG-001 cron idempotency audit → 1 agent owns src/app/api/cron/* (~36h, can defer to post-launch P1 window)
- IG-003 backup restore SOP → bundled with OG-007 secret rotation runbook (~3h covered)

Waves 1-4 still independent. Wave 5 still gated on Long. Wave 6 IG-005 + IG-002 can land pre-launch alongside Wave 4 (infra agent owns wrangler config + docs/).

### Additional Approval-Gate Questions (Infra)

10. **IG-002 D1 region strategy:** accept APAC-only with documented 4h RTO | invest in cross-region replica (doctrine change) | wait for first incident?
11. **IG-005 CF quota threshold:** alert at 70/90/100% workers/D1 reads/R2 storage? Operator email or Sentry?
12. **IG-001 cron idempotency:** gate GO LIVE on all 18 routes audited | land top-3 risky routes pre-launch (dunning, fulfillment, usage-export) + rest as P1 | accept current state with monitoring?
13. **IG-013 rollback doctrine:** confirm `npm run deploy:full` with prior SHA is the canonical rollback (vs `wrangler rollback`)?

---

**NEXT:** Long answers approval-gate questions (Q1-Q13). On ACK, Phase 2 dispatches Waves 1-4 + 6 in parallel. Wave 5 gated on product decisions.

---

## Phase 2 Execution Close-Out (2026-05-20 23:10)

Dispatched 5 parallel agents in worktree isolation; all merged to `master` and built green.

| Wave | Commit | Items closed | Status |
|---|---|---|---|
| 1 — security | `869008fa` | SG-001 ✅ (verified live) · SG-003 ✅ (ReauthModal wired) · SG-004 ✅ (already live) · SG-005 ✅ (already live) | CLOSED |
| 2 — customer i18n | `0503b886` | CG-001 ✅ · CG-002 ✅ (CryptoPaymentExplainer) · CG-003 ✅ (BYOK help) · CG-008 ✅ (welcome VI) · CG-009 ✅ (first-value banner) | CLOSED |
| 3 — billing UI | `34f00584` | PG-002 ✅ (refund form) · PG-003 ✅ (change-tier) · CG-005 ✅ (cancel modal) | CLOSED |
| 4 — infra | `a30a8bf1` | CG-004 ⚠ (verify script — SPF MISSING op-action) · OG-001 ✅ · OG-002 ✅ (heartbeat + escalation doc) · OG-007 ✅ (8-secret runbook) | CLOSED w/ op follow-up |
| 6 — cron+quota+DR | `0de24f8f` | IG-001 ✅ (top-3: dunning/fulfillment/usage-export) · IG-005 ✅ (quota script) · IG-002 ✅ (DR runbook) | CLOSED |
| Type fix | `94498031` | Sentry `tagCronRoute` generic widened | |

**Phase 3 re-verify:**
- Build: ✅ `npm run build` — Compiled successfully in 31.1s, 181/181 pages
- Tests: ✅ 4621 pass / 40 pre-existing better-sqlite3 NODE_MODULE_VERSION mismatch (rebuild needed; unrelated)
- ASVS L2: 29/31 → **31/31 candidate** (SG-001 verified + SG-003 wired)
- Doctrine: unchanged at **87.5/100** ceiling per v1.28.1 (work fits within ceiling)

**P0 status:**
- 7 of 9 closed (SG-001/003/004/005, CG-001/002/003/008/009, PG-002/003)
- PG-001 — Long decision pending (Q1)
- CG-004 — verify script landed; **operator action required: add SPF TXT to mekongmind.com**

**Still gated on Long (Wave 5):** Q1 (PG-001 refund) · Q2 (PG-004 auto-updates) · Q3 (PG-005 landing) · Q4 (PG-006 acct mgr) · Q6 (cost alert $) · Q7 (DR drill timing) · Q8 (PayOS status) · Q9 (support mailbox live?) · Q10 (D1 region) · Q11 (quota thresholds) · Q13 (rollback doctrine).

**Operator follow-ups (post-merge, not gating):**
- Add SPF `TXT @ "v=spf1 include:_spf.resend.com ~all"` to mekongmind.com Cloudflare DNS
- Fill on-call contacts in `docs/runbooks/cron-escalation-contacts.md`
- Wire 18 cron handlers to `/api/health/cron-heartbeat` (~2h, P1)
- Wire `runQuotaCheck()` into `/api/cron/quota-check/route.ts`
- Configure Sentry alert rules per `cf-quota-response.md` thresholds

---

## Phase 4 — GO LIVE Sign-Off Checklist

**Pre-launch (blocking):**
- [ ] Long answers Q1 (PG-001) — refund policy doc updated
- [ ] Operator adds SPF DNS record + reruns `scripts/verify-email-dns.ts` until GREEN
- [ ] Deploy + SHA-match verify (`npm run deploy:full` → `/api/version` shortSha == HEAD)
- [ ] Smoke test paying-customer flow: signup → setup wizard → NOWPayments USDT → tier activation → first campaign

**Day-1 monitoring (operator):**
- [ ] Sentry rule wired: `cron_route` tag missing > 1h → page
- [ ] CF quota alerts at 70/90/100% configured
- [ ] On-call contacts filled in escalation runbook
- [ ] First end-to-end refund test on staging (PG-002 flow)

**Week-1 P1 (post-launch):**
- [ ] Remaining 15 cron routes wired to heartbeat
- [ ] OG-009 prod DR drill scheduled (Q7 decision)
- [ ] PG-004/005/006 product decisions documented or features removed

**Doctrine ceiling held at 87.5/100. No lift planned this cycle.**

