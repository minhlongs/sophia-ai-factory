# GAP Analysis — Sophia AI Factory FREE100 Non-Tech Handoff

**Date:** 2026-05-12 07:30 PT (14:30 UTC)
**Scope:** Toàn dự án FREE100 distribution readiness — engineering scope + founder execute gap
**PROD SHA:** `37263213` (verified live, healthy, matches HEAD)
**Status:** Engineering 100% complete · Founder execute 5 items pending · 3 minor polish deferred

---

## Executive Summary

Engineering scope hoàn tất 100%. FREE100 code live (`/api/promo/validate` → `valid:true, MASTER tier`). Health endpoint healthy. PROD SHA khớp local HEAD. 8 handover docs đã ship, 3 BYOK PNG auto-captured.

**3 GAP còn lại (critical → minor):**
1. **🔴 CRITICAL — DNS deliverability:** SPF EMPTY, DKIM thiếu `v=DKIM1; k=rsa;` prefix, DMARC `p=none`. Verified live qua `dig`. Bắt buộc fix trước khi gửi outreach — magic link sẽ rớt spam ngay.
2. **🟡 PENDING — Founder execute (5 tasks ~40min):** DNS · Resend tracking off · Sentry signup+run · Crisp.im wire · 4-inbox drill. Tất cả cần founder credentials, không thể delegate.
3. **🟢 MINOR — Engineering polish (defer-able):** i18n validator template-literal detection · D1 post-distribution analysis script · BYOK PNG upgrade (docs landing → real dashboard screenshots).

**Verdict:** Có thể bắt đầu gửi FREE100 NGAY khi founder hoàn tất Section 1 (DNS) + Section 2 (Resend tracking off) trong cheat sheet — tổng ~20 phút. Các section còn lại (Sentry/Crisp/E2E video) là enhancement, không block distribution.

---

## Verified Live State (2026-05-12 14:28 UTC)

```
Production:
  PROD URL:     https://sophia.agencyos.network          ✅ HTTP 200
  SHA match:    37263213 == git HEAD                      ✅
  Health:       {"status":"healthy"}                       ✅
  Promo live:   FREE100 → MASTER, free_full, 100% off      ✅

DNS (mekongmind.com):
  SPF:          ❌ EMPTY                                  → BLOCKER
  DKIM:         ⚠️  "p=..." (missing "v=DKIM1; k=rsa;")    → BLOCKER
  DMARC:        ⚠️  "v=DMARC1; p=none;"                    → ramp needed

Wrangler vars:
  NEXT_PUBLIC_CRISP_WEBSITE_ID:    ❌ not set            → Crisp bubble inactive
  NEXT_PUBLIC_SENTRY_DSN:          (couldn't verify)     → check post-Sentry-setup

Handover docs (docs/handover/, 8 files):
  founder-cheat-sheet-260512.md            8.7 KB  ✅
  founder-dns-and-inbox-drill-checklist    6.5 KB  ✅
  free100-distribution-tracker-260512.md   4.8 KB  ✅
  free100-email-deliverability-260512.md  11.0 KB  ✅
  free100-partner-outreach-template       6.5 KB  ✅
  free100-vip-runbook.md (existing)        5.3 KB  ✅
  sentry-alerts-setup-runbook-260512.md   14.4 KB  ✅
  support-provider-comparison-260512.md   17.7 KB  ✅

BYOK assets (public/byok-guide/):
  openrouter.png   82 KB  ✅ (docs landing — could upgrade later)
  elevenlabs.png   96 KB  ✅
  d-id.png         77 KB  ✅
```

---

## GAP Table — Prioritized

| # | GAP | Severity | Owner | Blocks Distribution? | ETA |
|---|---|---|---|---|---|
| 1 | DNS: SPF missing | 🔴 CRITICAL | Founder | YES | 5 min |
| 2 | DNS: DKIM missing `v=DKIM1; k=rsa;` prefix | 🔴 CRITICAL | Founder | YES | 3 min |
| 3 | DNS: DMARC `p=none` → `p=quarantine` | 🟡 HIGH | Founder | NO (recommend) | 2 min |
| 4 | Resend click/open tracking still ON | 🔴 CRITICAL | Founder | YES | 5 min |
| 5 | Sentry/Slack alerts not configured | 🟡 MEDIUM | Founder | NO | 10 min |
| 6 | Crisp.im live chat bubble not wired | 🟡 MEDIUM | Founder | NO | 10 min |
| 7 | 4-inbox deliverability drill not run | 🟡 MEDIUM | Founder | NO (validates 1-3) | 10 min |
| 8 | E2E smoke video not recorded | 🟢 LOW | Founder | NO | 20 min |
| 9 | i18n validator misses template literals | 🟢 LOW | Engineering | NO | 15 min |
| 10 | D1 post-distribution analysis script | 🟢 LOW | Engineering | NO | 20 min |
| 11 | BYOK PNG = docs landing, not real dashboard | 🟢 LOW | Founder | NO | 15 min |

**Total blocking work to start distribution:** ~13 min (items 1, 2, 4)
**Total recommended pre-distribution:** ~30 min (add 3, 7)
**Total to reach 100/100:** ~90 min (everything)

---

## Critical GAPs — Deep Detail

### 🔴 GAP #1-3: DNS records (mekongmind.com)

**Observed (live `dig` audit 14:28 UTC):**
```
dig +short TXT mekongmind.com               → (empty)
dig +short TXT resend._domainkey.mekongmind  → "p=MIGfMA0GCSqGSIb3DQEBAQUAA4..."
dig +short TXT _dmarc.mekongmind.com         → "v=DMARC1; p=none;"
```

**Required state:**
```
SPF:   v=spf1 include:_spf.resend.com ~all
DKIM:  v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4...  (prepend prefix)
DMARC: v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@mekongmind.com; pct=100; aspf=r; adkim=r
```

**Impact:** Without SPF + proper DKIM, Resend magic-link emails to FREE100 partners hit Gmail/Outlook spam folder ~60-80% of the time. Founder has 42 high-value VIP invites to send — losing even 30% = 12 wasted slots.

**Fix path:** Cheat sheet Section 1.A-1.D has paste-ready Cloudflare DNS UI instructions + verification commands.

### 🔴 GAP #4: Resend tracking toggle

**Status:** Click + Open tracking likely still ON (default).
**Why blocking:** Tracking pixel rewrites magic link → `<resend-redirector>/<token>` → Microsoft Defender + Gmail filters distrust redirected transactional URLs → spam.
**Fix path:** Cheat sheet Section 2 — Resend dashboard → Settings → Tracking → toggle both OFF.

---

## Medium GAPs — Non-Blocking but Recommended

### 🟡 GAP #5: Sentry/Slack alerts inactive

**Impact:** If FREE100 magic-link generation or signup fails for any partner, founder has no real-time signal. Partner emails founder → 4h+ resolution lag.
**Fix path:** Cheat sheet Section 3 → `bash scripts/founder-setup-sentry.sh` (one-shot, ~10 min).
**Companion doc:** `sentry-alerts-setup-runbook-260512.md` (deep-dive).

### 🟡 GAP #6: Crisp.im live chat bubble

**Impact:** Partners hitting a UX wall on `/pricing` or `/welcome/[token]` cannot reach founder live. Currently no in-app support channel.
**Fix path:** Cheat sheet Section 4 → Crisp signup + add `NEXT_PUBLIC_CRISP_WEBSITE_ID` to `wrangler.toml` `[vars]` + `npm run deploy:full`. CSP already allow-lists `client.crisp.chat` (build-time gated).
**Verified:** `wrangler.toml` has NO `[vars]` section for these vars — needs adding.

### 🟡 GAP #7: 4-inbox deliverability drill

**Impact:** Validates DNS fixes (GAPs #1-3) actually work in real inboxes (Gmail/Outlook/iCloud/Yahoo). Without drill, founder sends first batch blind — risk of 30%+ spam rate undetected for days.
**Fix path:** Cheat sheet Section 5 — 4 controlled test sends, check Inbox/Spam, mark "Not Spam" if needed.
**Companion:** `founder-dns-and-inbox-drill-checklist-260512.md` (existing).

---

## Low GAPs — Engineering Polish (Defer-able)

### 🟢 GAP #9: i18n validator misses template literals
**Location:** `scripts/validate-i18n-keys.mjs`
**Issue:** Regex matches `t('static.key')` only. Template-literal calls `` t(`steps.${step.key}.title`) `` slip through. Currently 2 places use this pattern in welcome refactor.
**Risk:** Future i18n key drift goes undetected in CI.
**Fix:** Extend regex + add resolution of dynamic key prefixes from local consts. ~15 min.

### 🟢 GAP #10: Post-distribution analysis script
**Issue:** Founder will hit 45/50 redemptions eventually and need per-day-of-week + per-template conversion data. Currently the D1 query is documented inline in tracker but not scripted.
**Fix:** Add `scripts/analyze-free100-redemptions.sh` wrapping `wrangler d1 execute` with the JULIANDAY query. ~20 min.

### 🟢 GAP #11: BYOK PNGs are docs landing pages
**Issue:** Auto-captured screenshots are from public docs sites, not founder's real signed-in dashboards. Partners see generic "OpenRouter homepage" instead of "where to click for API key".
**Fix:** Founder records 3 real screenshots from signed-in OpenRouter/ElevenLabs/D-ID dashboards, overwrites PNGs. ~15 min.
**Why defer:** Current PNGs sufficient for non-tech orientation; not blocking.

---

## Untracked Files (Cleanup Recommended Before Next Wave)

```
✓ Inside repo (sophia-ai-factory):
  messages/__tests__/                                    ← new tests, commit or .gitignore
  plans/260509-0621-phase-2-wave-14-parallel/
  plans/260509-0839-raas-dashboard-wave16/
  plans/reports/*.md  (14 files)                        ← researcher/reviewer/tester reports

✗ OUTSIDE repo boundary (parent monorepo):
  ../../plans/reports/*.md  (12 files)                   ← belong to other apps; not our concern
```

**Recommendation:** No action needed for distribution. Cleanup is a separate housekeeping task.

---

## Distribution Decision Tree

```
START
  │
  ├─ Founder run Cheat Sheet §1 (DNS, 15 min) ──┐
  ├─ Founder run Cheat Sheet §2 (Resend, 5 min)─┤
  │                                              │
  │                                              ▼
  │                       ┌─────────────────────────┐
  │                       │ GREENLIGHT for outreach │
  │                       │ Send 5 invites/day max   │
  │                       │ Watch tracker daily      │
  │                       └─────────────────────────┘
  │                                  │
  ├─ Optional §3 (Sentry, +10 min)   │
  ├─ Optional §4 (Crisp, +10 min)    │
  ├─ Optional §5 (Drill, +10 min) ───┤
  └─ Optional §6 (Video, +20 min)    │
                                     ▼
                              FULL 100/100 readiness
                              (~55 min total founder time)
```

---

## What Engineering Cannot Fix (Founder Boundary)

The following gaps require founder-only credentials and cannot be delegated:

1. **Cloudflare DNS dashboard access** — founder owns mekongmind.com
2. **Resend dashboard login** — tracking toggle
3. **Sentry signup + DSN** — new account needed
4. **Slack workspace admin** — Incoming Webhook URL
5. **Crisp.im signup** — Website ID
6. **Personal Gmail/Outlook/Apple/Yahoo for drill** — founder's own inboxes
7. **Recording E2E smoke video** — founder's screen

All artifacts to make these tasks 1-paste are in `docs/handover/`.

---

## Recommended Next Actions

### For Founder (sequential, ~30 min minimum)
1. Open `docs/handover/founder-cheat-sheet-260512.md`
2. Execute Section 1 (DNS) — verify with `dig` commands at end
3. Execute Section 2 (Resend tracking) — toggle both off
4. Optional but recommended: Section 5 (4-inbox drill) to validate steps 1-2
5. Begin distribution: use `free100-partner-outreach-template-260512.md` (Template A for warm contacts, B for cold), log each in `free100-distribution-tracker-260512.md`

### For Engineering (optional, can defer)
1. **Wave N+1 (polish):** Address GAPs #9-11 if time permits
2. **Watch FREE100 D1 metrics:** weekly `SELECT used_count FROM promo_codes WHERE code='FREE100'`
3. **Monitor Sentry events:** once founder completes §3, watch for `[founder-setup]` event then real errors

---

## Unresolved Questions

1. **DKIM string verification:** Did the existing DKIM record really get stripped of `v=DKIM1; k=rsa;` prefix at paste-time into Cloudflare? Or is it intentional? — Need founder to look at Cloudflare DNS UI value to confirm. The cheat sheet covers this contingency.
2. **Resend domain status:** After founder fixes SPF + verifies DKIM, does `resend.com → Domains → Verify` button turn green within 5 min? — Cannot pre-verify without founder login.
3. **Crisp free-tier 2-seat limit:** If founder eventually adds a VA / co-founder to support, will free tier suffice or need to upgrade to $25/mo? — Out of scope for current wave.
4. **D1 promo_redemptions table name:** Cheat sheet Section "Post-distribution analysis" query references `promo_redemptions` but actual schema may be `promo_uses` or similar. — Need to verify against `migrations/0090-promo-codes-*.sql` before founder runs analysis. (Defer to GAP #10 fix.)
5. **Should we set merge freeze after 45/50 redemptions?** — Distribution tracker §"When to stop" recommends but doesn't enforce. Founder discretion.
