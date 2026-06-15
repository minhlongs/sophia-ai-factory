# Brainstorm — Sophia AI Factory: Zero-bug Dashboard + FREE100→Master + Client Handover

**Date:** 2026-05-17 22:23 PT
**Project:** Sophia AI Factory (`~/projects/sophia-ai-factory/apps/sophia-ai-factory/`)
**Production:** https://sophia.agencyos.network (HEAD `05b62157` synced GitHub + GitLab)
**Doctrine:** v1.28.1 no-tech — operator manages PLATFORM-ONLY, BYOK for customers
**Honest score ceiling under doctrine:** 87.5/100 (10-layer rubric)

---

## 1. Problem Statement

User goals (decoded from terse prompt):
1. **Dashboard audit** — đảm bảo no known critical bugs trên golden path
2. **FREE100 → Master tier** flow live, mỗi customer 1 code unique anti-abuse
3. **Bàn giao go-live cho client external** — standard handover package
4. **Worktree hygiene** — archive duplicate path tránh nhầm session sau

User chose: **Compliance-grade** zero-bug + **per-user code generator** + **Standard handover (runbook + training video)** + **archive duplicate path**.

---

## 2. Brutal Honesty — Reality Check

### 2.1 "Zero bug" claim
**Cannot promise.** 1,444 test files cover golden path nhưng không thể prove 100% bug-free. Truthful framing for client contract:
> *"No known critical bugs. All 1,444 tests passing. ESLint 0 errors. OWASP top-10 audit clean. Load tested up to 100 concurrent users. Known limitations documented in `docs/known-issues.md`."*

Bất kỳ contract nào hứa "zero bug" tuyệt đối = legal liability + setup-for-failure.

### 2.2 Compliance-grade timeline
User chọn "~1 week" — **realistic = 5-7 business days full-time**, KHÔNG phải 5-7 wall-clock days. Breakdown ở §6.

### 2.3 Doctrine ceiling
Compliance-grade work realistically pushes score to **~92-94/100**, KHÔNG 100. Doctrine v1.28.1 lock: lift > 92 cần *months* of DR drills + monthly restore tests + sustained operational track record — không thể achieve trong 1 sprint. Sell client trên *"production-hardened with verified DR drill + load test"*, không phải "100/100".

### 2.4 Promo system status
✅ **FREE100 infrastructure đã có 100%:**
- Schema: `migrations/0066-promo-codes.sql` + seed `0067` (verify seed có entry không)
- Redeem UI: `src/app/[locale]/redeem/` (page + client)
- Engine: `src/land/promo/` (types, repo, applier, validator)
- Auto-handover: `src/tree/handover/` (auto-install Starter SOP cho MASTER, magic link 72h)
- Admin CRUD: `/api/admin/promo-codes/{create,list,status,[id]/redemptions}` đã tồn tại
- Telegram notifier: `src/tree/telegram/telegram-handover-notifier.ts`
- R2 propagation: video-generate.ts step 7b (Wave 17 Phase 01)

❌ **Gaps cho per-user codes:**
- Bulk-generate endpoint (FREE100-XXXX × N) — chưa thấy, cần build mỏng wrap existing create API
- Admin UI để bulk-export CSV codes — chưa thấy
- Per-user single-use enforcement — schema có `max_uses_per_user=1` rồi, chỉ cần set đúng khi seed

### 2.5 Worktree divergent
- Canon: `~/projects/sophia-ai-factory/` HEAD `05b62157`
- Stale: `~/sophia-ai-factory/` HEAD `b0b34ffd` (independent commits)
- **Risk:** Session sau có thể `cd` nhầm path → push commits vào branch không origin → lost work hoặc divergence prod
- **Fix:** `mv ~/sophia-ai-factory ~/sophia-ai-factory.archived-260517` + add `.archived/STOP-DO-NOT-USE` marker file

---

## 3. Solution Approaches Evaluated

### Approach A: Pragmatic ship-grade (~4-8h)
- Golden path FREE100→Master live verify (browser Rule 13)
- All 1,444 tests pass
- ESLint 0 errors (already baseline)
- Known issues documented
- ❌ User declined — chọn compliance.

### Approach B: Hardened ship-grade (~2-3 days)
- Approach A + warning baseline <100 + a11y critical fixes + load test 100 concurrent
- ❌ User declined.

### Approach C: Compliance-grade (~5-7 days) ✅ CHOSEN
- Approach B + OWASP pen test report + DR drill executed + monthly restore proof + SOC2-lite checklist
- Realistic ceiling: ~92-94/100 (doctrine locks higher)

---

## 4. Recommended Solution — Compliance-Grade with Realistic Boundary

### 4.1 Scope (CONFIRMED with user)
1. **Audit dashboard** (20 routes) — full golden path verification
2. **FREE100 per-user codes** — build bulk-generate endpoint + admin UI
3. **DR drill** — actual restore from R2 backup to staging, document RTO/RPO measured
4. **OWASP top-10 audit** — automated scan + manual review of auth/promo/billing
5. **Load test** — k6 or autocannon 100 concurrent users on `/redeem` + `/dashboard`
6. **Handover package** — consolidate existing docs + record admin training video (~30min)
7. **Worktree cleanup** — archive `~/sophia-ai-factory/` duplicate

### 4.2 Out-of-scope (per doctrine)
- ❌ NO operator-side third-party setup (QStash, Sentry sourcemap, etc.) — doctrine v1.28.1
- ❌ NO Polar.sh — NOWPayments only
- ❌ NO claim "100/100" — ceiling 87.5 → realistic post-work 92-94
- ❌ NO promise "zero bug" — promise "no known critical bugs + verified DR + audited"

### 4.3 Anti-abuse design for FREE100-XXXX
- Per-user unique code: `FREE100-{8-char base32}` (e.g. `FREE100-X7K9M2QR`)
- Admin generates batch N, exports CSV for marketing team
- Each code: `max_uses=1`, `max_uses_per_user=1`, `applies_to_tier='master'`, `discount_type='free_full'`
- Bonus protection: rate-limit redeem endpoint (5 attempts/IP/hour) + email verification before grant
- Audit log all redemptions in `coupon_redemptions` table (migration `0025` đã có)

---

## 5. Implementation Considerations & Risks

### Risks
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| FREE100 seed missing in PROD D1 | Medium | High | Pre-flight: `wrangler d1 execute sophia-raas-db --command "SELECT * FROM promo_codes WHERE code LIKE 'FREE100%'"` |
| DR drill reveals unrecoverable data | Low | Critical | Run drill on STAGING D1 clone first, not PROD |
| Browser checkout Rule 13 fail mid-handover | Medium | High | Block "DONE" report until all 4 tier checkouts verified (Rule 13 mandatory) |
| Worktree archive breaks active session | Low | Medium | Check `lsof ~/sophia-ai-factory` before mv; coordinate if user has CC CLI session open |
| Training video record requires admin creds expose | Medium | Low | Record in incognito + dummy admin account, NOT real ops account |
| Load test crashes prod CF Worker | Low | Critical | Run against STAGING URL `sophia-staging.agencyos.network` (verify exists first) |
| Pen test discovers HIGH CVE in deps | Medium | Medium | `npm audit fix` then manual review; budget 1 day buffer |

### Dependencies
- Cloudflare API token (operator already has)
- NOWPayments sandbox credentials (for checkout flow verification — operator side)
- Wrangler CLI authenticated
- k6 or autocannon installed (`brew install k6`)
- OBS Studio or QuickTime for video recording

---

## 6. Realistic Day-by-Day Plan (5-7 business days)

| Day | Focus | Deliverables |
|-----|-------|--------------|
| **D1** | Audit + worktree | Archive duplicate path. Verify FREE100 seed in PROD D1. Run full test suite. Browser test all 20 dashboard routes. Inventory bugs in `docs/known-issues.md`. |
| **D2** | FREE100 bulk-gen | Build `POST /api/admin/promo-codes/bulk-generate` (loops create endpoint). Add admin UI `dashboard/admin/promo-codes/bulk`. CSV export. Tests. |
| **D3** | OWASP + load test | Pen test auth+promo+billing. `npm audit` fix. k6 load test 100 concurrent users `/redeem` + `/dashboard`. Document results. |
| **D4** | DR drill (actual) | Backup PROD D1 → R2. Restore to STAGING D1. Verify data integrity. Document measured RTO/RPO in `docs/dr-drill-260520.md`. |
| **D5** | Handover docs | Consolidate `GO-LIVE-DEPLOYMENT-GUIDE.md` + `disaster-recovery.md` + `dev-sops.md` → single `docs/CLIENT-HANDOVER-PACKAGE.md`. Incident playbook. Escalation contacts. |
| **D6** | Training video | Record 30min walkthrough: admin login → promo bulk-gen → handover flow → DR restore SOP → incident response. Upload to client-controlled drive. |
| **D7** | Smoke + sign-off | Browser test FREE100-XXXX end-to-end (Rule 13). All checkout tiers. Production HTTP 200 + `/api/version` SHA match. Final report + client sign-off. |

**Buffer: +1-2 days** for unexpected pen test findings or DR drill surprises.

---

## 7. Success Metrics & Validation

### Pre-go-live gates (ALL must pass)
- [ ] FREE100-XXXX seed verified in PROD D1 (≥1 active row)
- [ ] All 1,444 tests passing locally + CI
- [ ] ESLint 0 errors (warnings <423 baseline OK)
- [ ] `npm audit --audit-level=high` → 0 vulnerabilities
- [ ] Browser Rule 13 test passed (all 4 tier checkouts + FREE100-XXXX flow)
- [ ] DR drill report attached (measured RTO < 4h, RPO < 24h)
- [ ] Load test report: p95 latency <500ms @ 100 concurrent
- [ ] `docs/CLIENT-HANDOVER-PACKAGE.md` reviewed by user
- [ ] Training video reviewed by user
- [ ] Worktree `~/sophia-ai-factory/` archived
- [ ] Production SHA in `/api/version` matches local HEAD

### Post-handover SLA proposal (commercial — separate contract)
- Bug-fix retainer: critical <4h, high <24h, medium <1 week
- Monthly health check
- Quarterly DR drill (path to ceiling 95+)

---

## 8. Next Steps & Dependencies

### Immediate (before D1 starts)
1. **User decision needed:**
   - Confirm STAGING URL exists (or accept load test against PROD with rate limits)
   - Confirm NOWPayments sandbox creds available for checkout flow tests
   - Confirm client identity (for handover contract clauses / NDA scope)
   - Confirm campaign size (how many FREE100-XXXX codes to generate: 10? 100? 1000?)
2. **Auto-decisions (--auto flag):**
   - Tech stack: existing (no change per doctrine)
   - Parallel work: D2 + D3 can parallelize (different files); D4 (DR) must be serial
   - Deploy: CF-direct via `npm run deploy:full` (canonical per doctrine)

### Sequenced after this brainstorm
1. Run `/plan` to convert this brainstorm into 7-phase detailed implementation plan
2. Each phase = 1 markdown file in `plans/260517-2223-sophia-free100-handover/`
3. Execute via `/cook` per phase
4. Verify per Rule 13 (browser test) before reporting any phase done

---

## 9. Resolved Questions (2026-05-17 22:30 PT)

| # | Question | Answer | Impact |
|---|----------|--------|--------|
| 1 | STAGING env exists? | ❌ NO — verified via curl (no response). Only D1 `preview_id` exists, no Worker. | Must setup scratch staging Worker D1 (+0.5d) before D8 load test. |
| 2 | Campaign volume? | **Large 1000+ codes** | Full admin UI + CSV export + search/filter (+1d). |
| 3 | Pen test scope? | **Full** (Burp + OWASP ASVS L2 + privilege escalation) | +2-3d. |
| 4 | Magic link verification? | **E2E Playwright test + manual browser** | +0.5d Playwright write. |
| 5 | Client identity? | **Internal/friendly** | Skip NDA/legal clauses. -0.5d. Standard handover doc enough. |
| 6 | NOWPayments creds? | **Yes wired live in CF Worker secrets** | Just smoke test, no setup. |
| 7 | Training video distribution? | **Client Google Drive (private)** | Standard .mp4 upload. |

### Revised timeline (10 business days realistic)

| Day | Focus | Notes |
|-----|-------|-------|
| D1 | Audit dashboard + worktree archive + verify FREE100 seed PROD D1 | |
| D2 | Setup staging Worker + D1 clone | Required since staging missing |
| D3-D4 | FREE100-XXXX bulk-gen API + admin UI + CSV + search/filter | Large volume requires full UI |
| D5-D7 | Full pen test (Burp + ASVS L2) + remediate findings | +2-3d realistic |
| D8 | DR drill on staging D1 | Document RTO/RPO |
| D9 | Load test (k6, 100 concurrent on staging) + handover docs consolidate + Playwright E2E magic link | Parallel work possible |
| D10 | Record training video + browser smoke (Rule 13) + final sign-off | Upload to client Google Drive |

**Total: 10 business days (~2 calendar weeks).** Buffer +2 days for pen test surprises.

### Expected score impact
Pre-work: 87.5/100 (doctrine ceiling per memory)
Post-work realistic: **92-94/100** (DR drill + load test + pen test report = operational maturity uplift)
Beyond 94: needs months of monthly drills (doctrine v1.28.1 lock)

---

## 10. Final next step
Run `/plan` with this brainstorm context → generates `plans/260517-2223-sophia-free100-handover/` with 10-phase implementation plan (one .md per phase).
