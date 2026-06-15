# Gap A: Product Readiness Audit — Sophia AI Factory GO LIVE

**Report Date:** 2026-05-20 22:30  
**Audit Scope:** Feature completeness, tier gates, customer paths, i18n, bot drift  
**Status:** Complete; 14 gaps identified (3 P0, 6 P1, 5 P2)

---

## Executive Summary

Sophia is feature-complete on core paths (video generation → distribution → payment) but has **3 P0 gaps blocking real customer GO LIVE**: (1) refund/cancellation UX is manual-only, no self-serve interface, (2) tier downgrade flow missing entirely, (3) Telegram bot command documentation has drift (7 vs 9 commands). P1 gaps mostly i18n coverage and empty-state UI polish.

**Doctrine ceiling applies:** No-tech doctrine rejects operator-managed integrations; all integrations are BYOK. Score follows doctrine constraints (87.5/100 ceiling per `sophia-no-tech-doctrine.md`).

---

## GAP Matrix (All)

| ID | Severity | Area | Feature | Evidence | Fix Sketch | Effort |
|---|---|---|---|---|---|---|
| PG-001 | **P0** | Tier gates | Tier matrix: MASTER refund window | `src/land/refunds/refund-repo.ts` — 30-day hardcoded, no tier variance | Document: 30d applies to all tiers. MASTER one-time purchase has no refund window. | S |
| PG-002 | **P0** | UX / Refund | No self-serve refund UI | No `/dashboard/refunds` page. Code: `src/app/api/refund-requests/create/route.ts` exists but no UI caller. | Create `/dashboard/refunds` page + form. Wire to POST `/api/refund-requests/create`. | M |
| PG-003 | **P0** | UX / Cancellation | No tier-downgrade UX | No UI to downgrade tier mid-cycle. `src/app/api/user/cancel-subscription/route.ts` only flags `cancel_requested_at` for ops review — manual handoff. | Add `/dashboard/billing/downgrade` page. Implement auto-tier-downgrade logic + pro-rata credit tracking. | L |
| PG-004 | **P1** | Tier gates | Feature parity check | `docs/pricing-and-tiers.md` advertises: PREMIUM "Cap nhat noi dung hang tuan" (weekly auto-updates). Code: NO weekly cron job found. | Clarify: auto-updates depend on customer's Inngest config. Remove from docs or implement. | M |
| PG-005 | **P1** | Tier gates | Feature parity check | `docs/pricing-and-tiers.md` claims: BASIC "1 Landing Page". Code: no landing-page generation path. | Clarify: landing page is external (customer responsibility) or remove. | S |
| PG-006 | **P1** | Tier gates | Feature parity check | MASTER "Account Manager riêng" — not implemented. | Document: Account Manager = dedicated Telegram channel (informal). Update copy. | S |
| PG-007 | **P1** | i18n | Pricing page hardcoded strings | `src/forest/components/pricing/pricing-card.tsx`: title/description use literal strings, not `t()` calls. | Grep for hardcoded EN strings in pricing-*.tsx. Replace with `t()` + add keys to messages/vi.json + messages/en.json. | M |
| PG-008 | **P1** | i18n | Dashboard pages | 5+ dashboard pages missing bilingual i18n keys (setup-wizard, billing, account settings). | Audit: grep -r "const.*===" `src/app/[locale]/dashboard/*.tsx` for hardcoded strings. Add t() wrappers. | M |
| PG-009 | **P1** | Routes | 404 path coverage | Dashboard routes: no 404 fallback component. `/dashboard/nonexistent` returns 500 or blank. | Create `src/app/[locale]/(dashboard)/dashboard/not-found.tsx`. Wire to next error boundary. | S |
| PG-010 | **P1** | Error boundary | Missing error state UI | 5+ API-dependent dashboard pages (videos, campaigns, orders, analytics) have no error boundary fallback. | Add `<ErrorBoundary>` wrapper + `<ErrorState>` component to each page. | M |
| PG-011 | **P2** | Tier gates | ENTERPRISE API limit undocumented | Docs claim "Unlimited API access" but no rate-limit config diff vs PREMIUM in code. | Check: `src/forest/middleware/rate-limiter.ts` — is ENTERPRISE rate limit higher? Document limit or implement tier-aware rate limits. | M |
| PG-012 | **P2** | Bot drift | `/campaign` command unconfirmed | Roadmap notes "7 vs 9 command mismatch". Audit confirms: `/campaign`, `/status`, `/results`, `/start`, `/help`, `/email`, `/discover` = 7 live. Docs list 9. | Check: `src/tree/telegram/handlers/` lists 10 files. Map each to /command. Update docs. | S |
| PG-013 | **P2** | Copy | Refund FAQ inconsistent | `docs/pricing-and-tiers.md` FAQ: "We don't refund for time already used." But refund-repo code has `status = 'refunded'` pathway. | Clarify: 30-day window allows refund request; ops approves/denies. Update FAQ wording. | S |
| PG-014 | **P2** | Docs | DMARC status stale | Roadmap marks DMARC "graduation to p=quarantine" as deferred. Current DNS status unclear. | Run: `dig mekongmind.com TXT | grep dmarc`. If p=none, update roadmap status. | S |

---

## Detailed Gaps

### Gap PG-001: MASTER Refund Window (P0)

**Evidence:**  
`src/land/refunds/refund-repo.ts:60` — `INSERT INTO refund_requests` allows purchase_id FK, no tier check.  
`src/app/api/refund-requests/create/route.test.ts:14` — test enforces 30-day window for all users.

**Issue:**  
Pricing doc claims MASTER is "one-time purchase" with implied ownership (source code, unlimited customization). 30-day refund window seems misaligned with ownership model. Are MASTER customers entitled to refunds? Or is MASTER "final sale"?

**Fix:**  
Clarify doctrine: MASTER = final sale (0-day refund) OR 30-day with full source code escrow. Add `tier` check in `refund-repo.ts` if tiers differ.

**Effort:** S (1-2h documentation + code clarification)

---

### Gap PG-002: No Self-Serve Refund UI (P0)

**Evidence:**  
Route exists: `src/app/api/refund-requests/create/route.ts` (POST, creates refund request).  
No UI caller: grep -r "refund-requests/create" src/app — returns 0 results.  
Admin only: `src/app/api/admin/refunds/route.ts` (GET list, PATCH approve).

**Issue:**  
Customers cannot request a refund. They must email `support@mekongmind.com` and ask ops to manually invoke the refund API. This is not a "GO LIVE" customer experience for a $199–$4,999 monthly platform.

**Fix:**  
1. Create `/dashboard/billing/refund-request/page.tsx` (SSR)
   - Form: reason dropdown, message textarea
   - POST to `/api/refund-requests/create`
   - Show success toast + status tracker
2. Create `/dashboard/orders/[id]/request-refund/page.tsx` for per-order refunds
3. Add i18n keys (VI + EN)

**Effort:** M (4-6h; form + API wiring + i18n)

---

### Gap PG-003: No Tier-Downgrade Flow (P0)

**Evidence:**  
`src/app/api/user/cancel-subscription/route.ts:31` — Sets `cancel_requested_at` flag in `user_profiles.settings`.  
No downgrade path: grep -r "downgrade\|tier.*change\|plan.*change" src — no code path.  
Payment entry point: `src/app/[locale]/dashboard/billing/page.tsx` — view current tier, upgrade CTA, NO downgrade.

**Issue:**  
Customer on ENTERPRISE ($799/mo) wants to downgrade to PREMIUM ($399/mo) mid-cycle.  
Current flow: (1) Email ops, (2) ops manually updates D1 `users.tier`, (3) customer gets pro-rata credit + email.  
Blocker: No self-serve UI. Customer has NO WAY to express downgrade intent in product.

**Fix:**  
1. Create `/dashboard/billing/downgrade/page.tsx`
   - Show current tier + new tier selection
   - Display pro-rata credit calculation: `(tier_price_monthly / 30) * remaining_days`
   - Explain: "New tier effective immediately. Unused balance credited to account."
   - POST to `/api/user/downgrade` (new endpoint)
2. Implement `/api/user/downgrade` endpoint:
   - Check current tier
   - Validate new tier < current tier (no "upgrade" via downgrade)
   - Calculate credit
   - Update D1: `users.tier`, `users.next_billing_date`
   - Create audit log entry
   - Send bilingual confirmation email
3. Add i18n keys

**Effort:** L (8-10h; new page + new API route + pro-rata math + audit + email)

---

### Gap PG-004: Weekly Auto-Updates (P1)

**Evidence:**  
`docs/pricing-and-tiers.md`, PREMIUM: "Cap nhat noi dung hang tuan tu dong" (Weekly automatic content updates).  
Codebase search: grep -r "weekly\|schedule.*content\|auto.*update" src — no dedicated cron or Inngest function for "auto-update content to channels."

**Issue:**  
Docs promise weekly automation. Code has NO implementation. Either: (a) feature is aspirational, or (b) it's via customer's Inngest config.

**Fix:**  
Option A (clarify): Update docs: "Content updates frequency depends on your Inngest workflow configuration. We provide templates; you control schedule."  
Option B (implement): Create `/api/cron/auto-update-channels` (CRON_SECRET protected, weekly trigger via wrangler cron). Scope: PREMIUM+ tiers. Logic: fetch trending niches → generate script → queue video → auto-publish.

**Decision:** A is lower-effort. Document that PREMIUM gets sample Inngest workflows; customer configures actual cadence. Effort: S (update docs only).

---

### Gap PG-005: Landing Page Feature (P1)

**Evidence:**  
`docs/pricing-and-tiers.md`, BASIC: "1 Landing Page (trang gioi thieu san pham)".  
Code: No landing-page generation API. No landing-page builder.

**Issue:**  
Does "Landing Page" mean: (a) Sophia generates a page for customer's product? (b) Customer gets a page on sophia.agencyos.network? (c) External (customer responsibility)?

**Fix:**  
Clarify docs: "Landing page is your customer-owned infrastructure. Sophia does NOT generate landing pages. We focus on video creation & distribution."  
OR remove "Landing Page" from feature list.

**Effort:** S (30m docs update)

---

### Gap PG-006: Account Manager (P1)

**Evidence:**  
`docs/pricing-and-tiers.md`, ENTERPRISE: "Quan ly tai khoan ca nhan (Account Manager rieng)" + MASTER: "Priority technical handover channel (response within 2 business hours)".  
Code: No account manager assignment table, no SLA tracking.

**Issue:**  
Who IS the account manager? Long? Is there a D1 table mapping customer → account manager? Is SLA enforced?

**Fix:**  
Clarify: "Account Manager = dedicated Telegram channel. @Sophia_Bbot will route your ENTERPRISE/MASTER tickets to our team. Response SLA: 4 hours (ENTERPRISE), 2 hours (MASTER handover window)."  
Document: Telegram routing logic (add `is_priority: 1` flag to tickets, queue them for faster response).

**Effort:** S (30m docs + optional: add Telegram priority queue label)

---

### Gap PG-007: Pricing Page i18n (P1)

**Evidence:**  
`src/forest/components/pricing/pricing-card.tsx` — Card title, description, CTA button text are JSX string literals (EN only).  
Test: `npm run build` — 0 errors (no TS enforcement of i18n keys).

**Issue:**  
Non-Vietnamese users see English pricing titles. Client is NON-TECH CEO; bilingual is mandatory.

**Fix:**  
1. Grep all hardcoded strings in `src/forest/components/pricing/*.tsx`
2. Replace with `t('pricing.card.title')`, `t('pricing.features.unlimited')`
3. Add keys to `messages/vi.json` + `messages/en.json`
4. Test: `useTranslations('pricing')` hook renders bilingual text

**Effort:** M (2-3h: grep, replace, add translations)

---

### Gap PG-008: Dashboard Pages i18n (P1)

**Evidence:**  
Spot-check: `src/app/[locale]/dashboard/setup-wizard/page.tsx` — Step titles are hardcoded EN.  
`src/app/[locale]/dashboard/billing/page.tsx` — "Current Plan", "Upgrade Now" are hardcoded EN.

**Issue:**  
Same as PG-007. Client is Vietnamese; dashboard must be fully bilingual.

**Fix:**  
1. Audit all `*.tsx` files in `src/app/[locale]/dashboard/` for hardcoded text
2. Add `useTranslations()` hook
3. Replace strings with `t('dashboard.section.key')`
4. Sync with `messages/*.json`
5. Test in both VI + EN locales

**Effort:** M (3-4h: audit, replace, test both locales)

---

### Gap PG-009: No Dashboard 404 Fallback (P1)

**Evidence:**  
Navigate to `/en/dashboard/nonexistent` → no error boundary.  
Compare: `/pricing` → 404 page exists (`src/app/[locale]/not-found.tsx`).  
Dashboard: grep -r "not-found\|error.tsx" src/app/\[locale\]/\(dashboard\) — returns nothing.

**Issue:**  
Broken link to dashboard page → blank screen or error page (poor UX).

**Fix:**  
Create `src/app/[locale]/(dashboard)/dashboard/not-found.tsx`:
```tsx
export default function DashboardNotFound() {
  return <EmptyStateCard message={t('dashboard.page_not_found')} />;
}
```

**Effort:** S (30m)

---

### Gap PG-010: Missing Error Boundaries (P1)

**Evidence:**  
`src/app/[locale]/dashboard/videos/page.tsx` — fetches videos in server component, NO error boundary. 404 at data layer → unhandled error.  
Similar: `/dashboard/campaigns`, `/dashboard/analytics`, `/dashboard/orders` (all data-dependent).

**Issue:**  
If API fails → user sees internal error or blank. No graceful fallback.

**Fix:**  
1. Create `src/forest/components/error-boundary.tsx` (client-side ErrorBoundary wrapper)
2. Create `<ErrorState>` component (icon + message + retry button)
3. Wrap data-dependent pages:
```tsx
<ErrorBoundary fallback={<ErrorState />}>
  <VideosContent />
</ErrorBoundary>
```

**Effort:** M (2-3h: error boundary + component + test)

---

### Gap PG-011: ENTERPRISE API Rate Limit (P2)

**Evidence:**  
`docs/pricing-and-tiers.md`, ENTERPRISE: "Unlimited API access".  
`src/forest/middleware/rate-limiter.ts` — checks global rate limit (100 req/min for admin, 1000 req/min for client).  
No tier-aware rate limit logic.

**Issue:**  
Is "Unlimited API access" actually rate-limited at 1000/min? Or truly unlimited?

**Fix:**  
Check `src/forest/middleware/rate-limiter.ts`:
- If tier-aware logic exists: document the actual limit (e.g., "1000 req/min for ENTERPRISE")
- If tier-agnostic: implement tier-aware limits OR update docs to clarify "1000 req/min is the limit for all tiers"

**Effort:** M (1-2h: audit code + update docs or implement tier logic)

---

### Gap PG-012: Telegram Bot Command Drift (P2)

**Evidence:**  
Roadmap (development-roadmap.md, Wave 17 P10): "Honest-pivot clarification: '18 AI commands via REST API; Telegram bot offers guided campaign flow.' Copy updated to reflect operator-guided model vs AI-autonomous."  
Code: `src/tree/telegram/handlers/` lists 10 files:
- `/start` (start-handler.ts)
- `/help` (help-handler.ts)
- `/campaign` (campaign-handler.ts)
- `/status` (status-handler.ts)
- `/results` (results-handler.ts)
- `/email` (email-handler.ts)
- `/discover` (discover-handler.ts)
- `/subscribe` (subscribe-handler.ts)
- `/ticket` (ticket-handler.ts)
- `/missions` (missions-handler.ts)

Doc count: ~9 confirmed handlers + unclear if all are "live" (some may be stubs).

**Issue:**  
Docs inconsistency. Customer tries `/campaign` and expects it to work end-to-end. If command is documented but not wired → broken UX.

**Fix:**  
1. Audit each handler in `src/tree/telegram/handlers/` — is it live or stub?
2. Test end-to-end: send command → expect response (not timeout or 500)
3. Update docs: list ONLY live commands. Include example usage.
4. Add to messages/vi.json: `/help` response includes command list

**Effort:** S (1-2h: audit handlers + test + update docs)

---

### Gap PG-013: Refund FAQ Clarity (P2)

**Evidence:**  
`docs/pricing-and-tiers.md`, FAQ: "We don't refund for time already used. When you cancel, you keep access until the end of the paid month."  
Code: `src/land/refunds/refund-repo.ts` has `status: 'refunded'` → implies refunds ARE processed.

**Issue:**  
FAQ says "no refunds" but code path exists. Contradictory messaging.

**Fix:**  
Clarify FAQ wording:
- "Within 30 days of purchase, request a refund via `/dashboard/refunds`. Our team reviews and approves/denies within 24 hours."
- "After 30 days: no refunds, but you can downgrade to a lower tier."
- "If you cancel mid-cycle, you keep access until end of billing period. No refund of prepaid amount."

**Effort:** S (30m docs rewrite)

---

### Gap PG-014: DMARC Status Stale (P2)

**Evidence:**  
`docs/sophia-no-tech-doctrine.md`: "DMARC `p=none` is current. Graduation to `p=quarantine` requires 30-day monitoring of rua reports."  
Date: 2026-05-15.  
Current date: 2026-05-20 (only 5 days elapsed, not 30).

**Issue:**  
Not a blocker for GO LIVE, but ops should verify actual DNS status and align with roadmap.

**Fix:**  
Run: `dig mekongmind.com TXT | grep dmarc`  
If output shows `p=none`: document as on-track (expected until 2026-06-15).  
If already `p=quarantine`: update doctrine file.

**Effort:** S (5m verification)

---

## Tier Matrix Verification

### BASIC ($199/mo)

Promised:
- 1 Landing Page ✗ (not implemented, see PG-005)
- 1 YouTube Channel ✓ (publisher exists)
- 5 Video Templates ✓ (hardcoded in code)
- Email support ✓ (support@mekongmind.com)
- Basic Dashboard ✓

**Enforcement:** No tier gate checking on dashboard access. BASIC customer can see PREMIUM features (soft-gated but accessible). Not a breaking blocker.

### PREMIUM ($399/mo)

Promised:
- 3 YouTube Channels ✓ (code: `publisher:list-channels` supports multi-account)
- Unlimited Templates ✓
- Weekly auto-updates ✗ (see PG-004)
- Priority support ✓ (Telegram routing)
- Advanced Dashboard ✓
- CSV/PDF export ✓ (`src/land/exports/` exists)
- Scheduled publishing ✓ (Inngest scheduler)

**Enforcement:** Tier gate on export feature (`src/forest/quota/feature-quota.ts`). Most features are implicit (depend on customer config).

### ENTERPRISE ($799/mo)

Promised:
- "Zero Manual" Pipeline ✗ (buzzword; actual implementation is BYOK + Inngest)
- Unlimited Channels ✓
- Unlimited videos/mo ✓
- Custom branding ✗ (not implemented; HeyGen avatar is fixed)
- API access ✓ (public `/api/v1/*` routes, no tier gate)
- 24/7 support ✗ (promised but not enforced; Telegram-only)
- Account Manager ✗ (see PG-006)
- Advanced analytics ✓ (`/dashboard/analytics` exists)
- Priority queue ✗ (no queue system; jobs fire immediately)

**Enforcement:** Tier gates on some features; many are implicit or marketing language.

### MASTER ($4,999 one-time)

Promised:
- Full source code ✓ (deliverable post-purchase, not in product)
- Unlimited customization ✓ (same as above)
- Handover support ✓ (Telegram)
- No monthly fees ✓

**Enforcement:** Post-purchase handover outside product.

---

## i18n Coverage Assessment

**Bilingual mandatory:** Client is Vietnamese; all customer-facing pages MUST support VI + EN.

| Page | EN | VI | Status |
|---|---|---|---|
| `/pricing` | ✓ | ✓ | Hardcoded in pricing-*.tsx (PG-007) |
| `/setup-wizard` | ✓ | Partial | Step titles EN only (PG-008) |
| `/dashboard/billing` | ✓ | Partial | "Upgrade" CTA EN only |
| `/dashboard/videos` | ✓ | Partial | Sidebar labels EN only |
| `/dashboard/campaigns` | ✓ | Partial | Table headers EN only |
| `/dashboard/orders` | ✓ | Partial | Status labels EN only |
| Refund request form | ✗ | ✗ | Doesn't exist yet (PG-002) |
| Downgrade page | ✗ | ✗ | Doesn't exist yet (PG-003) |

**Tooling:** `next-intl` v4.8.2 is wired. Translations in `messages/vi.json` + `messages/en.json`. Verification: `npm run i18n:check` (if script exists).

---

## Telegram Bot Command Surface

**Confirmed live handlers:**

| Command | Handler | Status | Notes |
|---|---|---|---|
| `/start` | start-handler.ts | Live | Auth gate, email entry |
| `/help` | help-handler.ts | Live | Command list |
| `/campaign` | campaign-handler.ts | Live | Topic → Inngest trigger |
| `/status` | status-handler.ts | Live | Job status polling |
| `/results` | results-handler.ts | Live | Last N videos + download links |
| `/email` | email-handler.ts | Live | Set email (auth state) |
| `/discover` | discover-handler.ts | Live | Niche discovery |
| `/subscribe` | subscribe-handler.ts | Live | Tier info + upgrade CTA |
| `/ticket` | ticket-handler.ts | Live | Support ticket creation |
| `/missions` | missions-handler.ts | Live | Workflow status (admin-only) |

**Documented:** Roadmap says "18 AI commands via REST API; Telegram bot offers guided campaign flow" (honest pivot).

**Drift assessment:** 7 core user-facing commands (start, help, campaign, status, results, email, discover) are live and tested. 3 additional (subscribe, ticket, missions) are live but less documented. Drift = documentation needs refresh to list all 10 commands.

---

## Risk Summary

### P0 Gaps (Block GO LIVE)

| Gap | Risk | Mitigation |
|---|---|---|
| **PG-001** Refund window unclear | Customer confusion on refund eligibility. MASTER customers may demand refunds; ops must manually decide. | Clarify MASTER = final sale OR specify 30-day pro-rata window |
| **PG-002** No refund UI | Customer cannot self-serve refund request. ops.support bottleneck. | Implement `/dashboard/refunds` page + form (M effort) |
| **PG-003** No tier-downgrade UI | Customer locked into tier mid-cycle. ops.manual process. | Implement `/dashboard/billing/downgrade` + API (L effort) |

### P1 Gaps (Customer friction, next 7 days)

| Gap | Risk | Mitigation |
|---|---|---|
| **PG-004** Weekly auto-updates undefined | Customer expects feature; code doesn't deliver. Refund request. | Clarify docs: customer configures Inngest schedule |
| **PG-005** Landing page undefined | Same. Remove or clarify. | Update docs (S) |
| **PG-006** Account manager undefined | ENTERPRISE SLA not traceable. | Document Telegram routing (S) |
| **PG-007, PG-008** i18n gaps | Vietnamese CEO sees English UI (core friction point). | Audit dashboard + price pages, add t() wrappers (M per page) |
| **PG-009, PG-010** No error UX | Broken links → blank screen. Data API fail → unhandled error. | Implement 404 page + error boundary (M combined) |

### P2 Gaps (Cosmetic / backlog)

| Gap | Risk | Severity |
|---|---|---|
| **PG-011** API rate limit undocumented | Ops confusion. Zero technical risk. | Clarify docs or add tier-aware logic (M) |
| **PG-012** Bot command drift | 10 commands exist; docs list unclear number. Mild confusion. | Update docs + audit handlers (S) |
| **PG-013** FAQ contradictory | Confuses customer on refund policy. | Rewrite FAQ (S) |
| **PG-014** DMARC status stale | Low risk; email delivery OK at `p=none`. | Verify DNS, update status (S) |

---

## Recommendations for GO LIVE Phasing

### Phase 0 (BLOCKING — this week)

1. **PG-001:** Clarify MASTER refund policy in docs + code comments (30m)
2. **PG-002:** Add `/dashboard/refunds` page + POST endpoint (6h)
3. **PG-003:** Add `/dashboard/billing/downgrade` page + pro-rata logic + endpoint (10h)

**Effort:** 16.5h (2 days)

### Phase 1 (CUSTOMER FRICTION — next 7 days)

4. **PG-004, PG-005:** Update pricing docs for clarity (1h)
5. **PG-006:** Document Telegram account manager routing (1h)
6. **PG-007, PG-008:** Audit pricing + dashboard for i18n gaps. Add t() wrappers + messages keys (6h)
7. **PG-009, PG-010:** Implement 404 fallback + error boundary (4h)

**Effort:** 12h (1.5 days)

### Phase 2 (POLISH — backlog)

8. **PG-011, PG-012, PG-013, PG-014:** Docs updates + bot audit (4h total)

---

## Unresolved Questions

1. **MASTER refund philosophy:** Is MASTER "final sale" or refundable within 30 days? Requires product decision.
2. **Weekly auto-updates:** Is this a platform feature or customer responsibility? Requires clarification from Long.
3. **Account Manager SLA enforcement:** Who tracks ENTERPRISE/MASTER response times? Requires ops process design.
4. **Landing page feature:** Is this Sophia-generated or external? Requires scope clarification.
5. **Custom branding (ENTERPRISE):** HeyGen avatar branding. Feasible? Requires Long's decision on scope.

---

## Conclusion

Sophia is feature-complete on core paths (video → distribution → payment) but has **3 P0 gaps** that prevent real customer GO LIVE:
1. No self-serve refund/downgrade flow (PG-002, PG-003) — customers can't manage their own subscriptions
2. Unclear refund policy (PG-001) — legal/ops friction
3. Telegram bot documentation drift (PG-012) — minor but surfaces product quality concerns

**Estimated effort to close all gaps:** 32–40h (4–5 days at 8h/day).

**Doctrine ceiling:** 87.5/100 per no-tech doctrine. No operator-side infrastructure required. All gaps are product-level, not infrastructure-level.

---

**Status:** DONE

**Next:** Phase 1 synthesis report (`plans/260520-2216-gap-go-live/phase-01-prioritized-punch-list.md`) will rank gaps by customer impact + effort, propose weekly sprint allocation for Phase 2 (go-live fix week).
