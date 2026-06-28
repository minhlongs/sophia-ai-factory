# BE→FE Gap Upgrade Plan — Phase 3 Deep Logic

**Date:** 2026-06-04  
**Target:** Serve CEO Media tận răng — mọi BE capability có FE page  
**Doctrine:** SUSPENDED (honest scoring). Show what exists; what works, works; what's API-only gets a page.

---

## Executive Summary

BE có **383 API routes** nhưng FE chỉ expose **~40 pages**. Kết quả: CEO Media và MASTER users nhìn dashboard thấy thiếu mất 60%+ năng lực backend. Các trang quan trọng như Finance, Affiliate, Leaderboard, Advisor đã có page nhưng **không có link trong sidebar** — như tồn kho trong kho mà không bày ra quầy.

**Gap tổng:**
- 6 non-admin pages tồn tại nhưng không có sidebar link
- 1 missing entry point (`/dashboard/finance`)
- 6 admin pages tồn tại nhưng không có sidebar link
- 1 sidebar item (`/dashboard/admin`) trỏ đến không có page.tsx
- 4 orphan API route groups không có FE page nào
- 2 bugs (experiments endpoint, agents import smell)

---

## Section 1: Complete Inventory

### 1.1 Sidebar vs Actual Pages (Admin)

| Sidebar has | Page exists? | Status |
|---|---|---|
| `/dashboard/admin` | ❌ MISSING | Need `admin/page.tsx` redirect |
| `/dashboard/admin/affiliate-leaderboard` | ✅ | OK |
| `/dashboard/admin/api-key-usage` | ✅ | OK |
| `/dashboard/admin/audit-log` | ✅ | OK |
| `/dashboard/admin/cost` | ✅ | OK |
| `/dashboard/admin/crons` | ✅ | OK |
| `/dashboard/admin/deploy-status` | ✅ | OK |
| `/dashboard/admin/e2e-smoke` | ✅ | OK |
| `/dashboard/admin/email-outbox` | ✅ | OK |
| `/dashboard/admin/webhook-deliveries` | ✅ | OK |
| `/dashboard/admin/storage` | ✅ | OK |
| `/dashboard/admin/tenant-lookup` | ✅ | OK |
| `/dashboard/admin/migrations` | ✅ | OK |
| `/dashboard/admin/heygen-webhooks` | ✅ | OK |
| `/dashboard/admin/funnel` | ✅ | OK |
| `/dashboard/admin/ops` | ✅ | OK |

### 1.2 Admin Pages WITHOUT Sidebar Link (6 pages)

| Page dir | Page.tsx | Client component | Action |
|---|---|---|---|
| `actions` | ✅ | `admin-actions-console.tsx` | Add sidebar link |
| `go-live-checklist` | ✅ | `go-live-checklist-client.tsx` | Add sidebar link |
| `handover` | ✅ | `handover-wizard-client.tsx` | Add sidebar link |
| `invites` | ✅ | `actions.ts` | Add sidebar link |
| `pricing` | ✅ | `admin-pricing-editor.tsx` | Add sidebar link |
| `refunds` | ✅ | `admin-refund-table.tsx` | Add sidebar link |

### 1.3 Non-Admin Pages WITHOUT Sidebar Link (6 pages)

| Page | Lines | BE Logic? | Action |
|---|---|---|---|
| `agents` | 28 | ✅ /api/agents/list (poll 5s) | Add sidebar link + fix import smell |
| `advisor` | 77 | ✅ RevenueAdvisorClient (ENTERPRISE) | Add sidebar link |
| `affiliate` | 185 | ✅ 4 D1 queries + CSV export | Add sidebar link |
| `api-docs` | 123 | ✅ 5 hardcoded endpoints | Add sidebar link |
| `experiments` | 43 | ⚠️ Bug: returns variant not list | Add sidebar link + bug fix |
| `leaderboard` | 139 | ✅ TopAffiliates + CreatorsTable | Add sidebar link |

### 1.4 Missing Entry Points

| What | Status |
|---|---|
| `/dashboard/finance` (page.tsx) | ❌ MISSING — only `finance/reports/page.tsx` exists |
| `/dashboard/videos/page.tsx` | ❌ MISSING — dir exists but no page |

### 1.5 Orphan API Routes (No FE Page Anywhere)

| API Route Group | Endpoints | FE Page? | Plan |
|---|---|---|---|
| `admin/licenses` | list, audit, create, [id] extend/reactivate/regenerate | ❌ None | New admin page |
| `admin/dunning` | [nonce], [nonce]/restore, [nonce]/suspend | ❌ None | Extend billing page |
| `admin/payouts` | queue, mark-paid | ❌ None | New admin page OR extend affiliate |
| `admin/billing` | summary, overage-events | ❌ None | Extend billing page |
| `handover/me` | user-facing handover | ❌ None | New user page |
| `v1/sop` | [id], [id]/trigger | ❌ None | Extend sops page |

---

## Section 2: Upgrade Plan by Priority

### Priority P0 — Navigation Completeness (ship first)

**Goal:** Mọi page đã tồn tại phải có thể navigate đến từ sidebar.

#### Task P0-1: Thêm 6 non-admin pages vào sidebar

Pages: agents, advisor, affiliate, api-docs, experiments, leaderboard

**Location:** `src/forest/components/dashboard/dashboard-sidebar-nav.tsx`

**Insert after** `/dashboard/help` (trước Account & Settings divider):

```tsx
{/* Revenue & Intelligence */}
<Link href="/dashboard/affiliate" ...><Coins /> <span>Affiliate</span></Link>
<Link href="/dashboard/leaderboard" ...><Trophy /> <span>Leaderboard</span></Link>
<Link href="/dashboard/experiments" ...><FlaskConical /> <span>Experiments</span></Link>
<Link href="/dashboard/api-docs" ...><Code /> <span>API Docs</span></Link>
<Link href="/dashboard/advisor" ...><Brain /> <span>Revenue Advisor</span></Link>
<Link href="/dashboard/agents" ...><Rocket /> <span>Agents</span></Link>
```

**Tier gating:**
- Advisor: ENTERPRISE only (đã có `canAccessRevenue()` guard)
- API Docs: MASTER+ (đã có tier gate)
- Others: all authenticated users

#### Task P0-2: Thêm 6 admin pages vào sidebar

Pages: actions, go-live-checklist, handover, invites, pricing, refunds

**Location:** Admin section, after `/dashboard/admin/heygen-webhooks`:

```tsx
<Link href="/dashboard/admin/actions" ...><Terminal /> Actions Console</Link>
<Link href="/dashboard/admin/invites" ...><UserPlus /> Invites</Link>
<Link href="/dashboard/admin/pricing" ...><DollarSign /> Pricing</Link>
<Link href="/dashboard/admin/refunds" ...><Undo2 /> Refunds</Link>
<Link href="/dashboard/admin/handover" ...><ArrowRightLeft /> Handover</Link>
<Link href="/dashboard/admin/go-live-checklist" ...><CheckCircle /> Go-Live Checklist</Link>
```

#### Task P0-3: Tạo `/dashboard/admin/page.tsx`

**Redirect** đến `/dashboard/admin/ops` (admin home = ops dashboard).

```tsx
// src/app/[locale]/dashboard/admin/page.tsx
import { redirect } from 'next/navigation';
export default function AdminHome() {
  redirect('/dashboard/admin/ops');
}
```

#### Task P0-4: Tạo `/dashboard/finance/page.tsx` + sidebar link

Thin wrapper → redirect to `/dashboard/finance/reports`. Finance entry point hiện đã có nested reports page, chỉ thiếu entry.

```tsx
// src/app/[locale]/dashboard/finance/page.tsx
import { redirect } from 'next/navigation';
export default function FinanceHome() {
  redirect('/dashboard/finance/reports');
}
```

**Sidebar:** Thêm `/dashboard/finance` → Finance Reports (ChartPie icon) trong Core section, sau `/dashboard/sops`.

---

### Priority P1 — Bug Fixes (ship cùng P0)

#### Task P1-1: Fix Experiments endpoint

**Bug:** `/api/signals/experiments` trả về variant assignment thay vì experiment list.

**Current:** `assignVariant()` → returns `{ experiment, variant, distinctId }`  
**Expected:** Returns `{ experiments: [...] }` array of all experiments.

**Fix approach (non-breaking):**
```
GET /api/signals/experiments?action=list → returns { experiments: [...] }
GET /api/signals/experiments?experiment=X&distinctId=Y → returns { variant, ... } (existing)
```

**FE change:** `experiments-widget.tsx` update URL to `?action=list`.

#### Task P1-2: Fix AgentTeamPanel import smell

**Current:** `agents/page.tsx` imports from `@/forest/components/missions/agent-team-panel`

**Fix:** Tạo `src/forest/components/dashboard/agent-team-panel.tsx` re-export, hoặc move component vào dashboard folder.

---

### Priority P2 — New Admin Pages for Orphan APIs (sprint 2)

#### Task P2-1: Licenses Management Page

**API:** `/api/admin/licenses` (list, audit, create), `/api/admin/licenses/[id]` (extend, reactivate, regenerate)

**New page:** `/dashboard/admin/licenses`

**Features:**
- License table: ID, user, tier, status, expires_at, created_at
- Actions: extend (30d/90d/365d), reactivate, regenerate key
- Audit log tab: `/api/admin/licenses/audit`
- Create new license modal

**Client component:** `licenses-client.tsx` — useSWR polling `/api/admin/licenses`

#### Task P2-2: Payouts Management Page

**API:** `/api/admin/payouts/queue`, `/api/admin/payouts/mark-paid`

**New page:** `/dashboard/admin/payouts`

**Features:**
- Pending payouts queue từ affiliate users
- Mark as paid button
- Filter by status (pending/paid/failed)

**Note:** User-facing affiliate payouts đã có ở `/api/affiliate/payouts` → nên extend affiliate page thay vì tạo mới. Admin page để manage tất cả.

#### Task P2-3: Handover User Page

**API:** `/api/handover/me`

**New page:** `/dashboard/handover` (user-facing, không phải admin)

**Features:**
- Show customer's handover status
- SOP installation progress
- Wizard steps (đã có `handover-wizard-client.tsx` trong admin/handover)

#### Task P2-4: Billing Enhancement

**API:** `/api/admin/billing/summary`, `/api/admin/billing/overage-events`, `/api/admin/dunning/[nonce]`

**Extend:** `/dashboard/billing` page để include:
- Admin billing summary (if MASTER)
- Overage events table
- Dunning status + actions (restore/suspend)

---

### Priority P3 — BE→FE Revenue Features (serve CEO Media)

#### Task P3-1: SOP RaaS Trigger Button

**API:** `/api/v1/sop/[installationId]/trigger`, `/api/sop/runs`

**Extend:** `sops/page.tsx` để thêm "Run Now" button cho mỗi SOP installation.

**Logic:** Poll `/api/sop/runs` sau khi trigger → show run status (running/success/failed).

#### Task P3-2: Campaigns Full Logic

**Current:** `campaigns/page.tsx` (84 lines) — cần kiểm tra client component.

**API available:** `/api/v1/campaigns`, `/api/v1/campaigns/create`, `/api/cron/scheduled-campaigns`

**Gap:** Campaigns page nên có:
- Campaign list với status badges
- Create campaign wizard (kết nối với RaaS missions)
- Schedule/retry controls

#### Task P3-3: Creative Studio Full Logic

**Current:** `creative-studio/page.tsx` (59 lines)

**API available:** `/api/v1/creative-studio/images`, `images/generate`, `images/[id]/status`

**Gap:** Image generation UI với progress tracking, gallery view.

#### Task P3-4: Wallet Payment Flow Check

**Current:** `wallet/page.tsx` (257 lines) — đã có logic.

**API available:** `/api/payments/one-time-checkout`, `/api/webhooks/nowpayments`

**Gap:** Kiểm tra wallet page có kết nối payment flow không. Nếu chưa có checkout button → thêm.

#### Task P3-5: Videos Page Resolution

**Current:** `/dashboard/videos/` dir exists nhưng KHÔNG có `page.tsx`.

**API available:** `/api/v1/missions/[id]/generate-video`, `/api/v1/missions/[id]/stream`

**Action:** Redirect to `/dashboard/campaigns` (videos = campaign outputs). Sidebar đã có "My Videos" link trỏ đến `/dashboard/campaigns`.

**→ KHÔNG CẦN page mới**, chỉ cần đảm bảo campaigns page hiển thị video outputs.

---

## Section 3: Test Strategy

### 3.1 Unit Tests (vitest)

**Pattern:** Mỗi new client component → test file cạnh component.

```
src/forest/components/dashboard/
├── licenses-client.tsx
│   └── licenses-client.test.tsx    — mock /api/admin/licenses
├── payouts-client.tsx
│   └── payouts-client.test.tsx     — mock /api/admin/payouts
├── experiments-widget.test.tsx     — test data shape fix
```

**Coverage target:** 80% cho mỗi new client component.

### 3.2 Integration Tests

**Pattern:** API route → FE page data flow.

```
tests/integration/
├── sidebar-navigation.test.ts      — verify all sidebar links resolve
├── admin-pages-access.test.ts      — MASTER tier gate for admin pages
├── finance-entry.test.ts           — /dashboard/finance → redirects to reports
├── experiments-data.test.ts        — verify experiments endpoint returns list
├── licenses-api.test.ts            — CRUD cycle for admin licenses
```

**Key integration scenarios:**
1. Navigate từ sidebar → mỗi page → verify no 404
2. Admin pages → verify MASTER tier gate
3. Experiments → verify endpoint returns array not variant
4. Finance → verify P&L data renders

### 3.3 E2E Smoke Tests (Playwright)

**Add to existing `e2e-smoke` flow:**

```ts
// tests/e2e/navigation-completeness.spec.ts
test.describe('Sidebar Navigation Completeness', () => {
  test('all sidebar links are reachable', async ({ page }) => {
    await page.goto('/dashboard');
    const links = page.locator('[aria-label="Dashboard sidebar"] a');
    const count = await links.count();
    for (let i = 0; i < count; i++) {
      const href = await links.nth(i).getAttribute('href');
      if (href && !href.includes('replay-tour')) {
        await page.goto(href);
        await expect(page.locator('body')).toBeVisible();
      }
    }
  });
});
```

### 3.4 Pre-Deploy Test Gate

**Update `scripts/deploy-with-sha.sh` Step 0.7:**

```bash
# Add navigation completeness check
npx playwright test tests/e2e/navigation-completeness.spec.ts --project=chromium --reporter=line
# Add sidebar link existence check  
npx vitest run tests/integration/sidebar-navigation.test.ts
```

---

## Section 4: Implementation Order

### Sprint A (Week 1) — P0 + P1

| Day | Tasks |
|---|---|
| 1-2 | P0-1: Add 6 non-admin sidebar links |
| 2-3 | P0-2: Add 6 admin sidebar links |
| 3 | P0-3: Create admin/page.tsx redirect |
| 3 | P0-4: Create finance/page.tsx + sidebar link |
| 4 | P1-1: Fix experiments endpoint + widget |
| 4 | P1-2: Fix AgentTeamPanel import smell |
| 5 | Test: integration tests for navigation + experiments |

### Sprint B (Week 2-3) — P2

| Day | Tasks |
|---|---|
| 1-3 | P2-1: Licenses admin page |
| 2-4 | P2-2: Payouts admin page |
| 3-5 | P2-3: Handover user page |
| 4-5 | P2-4: Billing enhancement (dunning + overage) |

### Sprint C (Week 4) — P3

| Day | Tasks |
|---|---|
| 1-2 | P3-1: SOP RaaS trigger button |
| 2-3 | P3-2: Campaigns full logic |
| 3-4 | P3-3: Creative Studio full logic |
| 4 | P3-4: Wallet payment flow check |
| 5 | Final: E2E tests + deploy gate |

---

## Section 5: Risk & Mitigation

| Risk | Mitigation |
|---|---|
| Sidebar too long (36→50 items) | Group into collapsible sub-sections |
| Admin pages slow D1 queries | Use `useSWR` with 30s stale time |
| Experiments endpoint breaking change | Add `/list` suffix, keep old for backward compat |
| Tier gate bypass on new pages | Server component `requireMasterTier()` + middleware check |
| Import smell causing circular dep | Re-export pattern (no logic change) |

---

## Section 6: Success Criteria

### Before Deploy:
- [ ] 5679 existing vitest tests pass
- [ ] New vitest tests: >=80% coverage on new components
- [ ] Navigation E2E: every sidebar link -> no 404
- [ ] Experiments endpoint returns array (not variant)
- [ ] `npm run test:smoke` passes on prod
- [ ] `npm run type-check` clean
- [ ] `npm run lint` < 400 warnings (no new errors)

### After Deploy:
- [ ] CEO Media có thể navigate đến mọi page từ sidebar
- [ ] Finance entry point hoạt động
- [ ] Admin có thể manage licenses, payouts, dunning
- [ ] Experiments data renders correctly
- [ ] Không có console error trong prod CF tail

---

## Section 7: File Change Summary

| File | Action | Lines Delta |
|---|---|---|
| `src/forest/components/dashboard/dashboard-sidebar-nav.tsx` | Edit | +13 sidebar items |
| `src/app/[locale]/dashboard/admin/page.tsx` | Create | +6 (redirect) |
| `src/app/[locale]/dashboard/finance/page.tsx` | Create | +8 (redirect) |
| `src/app/api/signals/experiments/route.ts` | Edit | +20 (list endpoint) |
| `src/forest/components/dashboard/agent-team-panel.tsx` | Create | +3 (re-export) |
| `src/app/[locale]/dashboard/agents/page.tsx` | Edit | -1 (fix import) |
| `src/forest/components/dashboard/licenses-client.tsx` | Create | +150 |
| `src/app/[locale]/dashboard/admin/licenses/page.tsx` | Create | +12 |
| `src/forest/components/dashboard/payouts-client.tsx` | Create | +120 |
| `src/app/[locale]/dashboard/admin/payouts/page.tsx` | Create | +10 |
| `src/app/[locale]/dashboard/handover/page.tsx` | Create | +15 |
| `src/app/[locale]/dashboard/billing/page.tsx` | Edit | +40 (dunning + overage) |
| `tests/integration/sidebar-navigation.test.ts` | Create | +80 |
| `tests/integration/experiments-data.test.ts` | Create | +30 |
| `tests/e2e/navigation-completeness.spec.ts` | Create | +50 |

**Total estimate:** ~550 new lines, ~30 lines modified.

---

## Appendix A: Complete Sidebar Map (After Upgrade)

### Main Section
| # | Link | Icon | Page Status |
|---|---|---|---|
| 1 | Overview | LayoutDashboard | Existing |
| 2 | New Project | PlusCircle | Existing |
| 3 | My Videos | Video | Existing (-> campaigns) |
| 4 | Creative Studio | Sparkles | Existing |
| 5 | Proposals | FileText | Existing |
| 6 | Analytics | BarChart2 | Existing |
| 7 | Voices | Mic | Existing |
| 8 | Templates | LayoutTemplate | Existing |
| 9 | Orders | ShoppingBag | Existing |
| 10 | **Agents** | **Rocket** | **NEW LINK** |
| 11 | **Affiliate** | **Coins** | **NEW LINK** |
| 12 | **Leaderboard** | **Trophy** | **NEW LINK** |

### Core Section
| # | Link | Icon | Page Status |
|---|---|---|---|
| 13 | Missions | Rocket | Existing |
| 14 | SOP Marketplace | Store | Existing |
| 15 | My SOPs | BookOpen | Existing |
| 16 | SOP Creator | Sparkles | Admin-only |
| 17 | Challenges | Target | Existing |
| 18 | **Finance** | **TrendingUp** | **NEW LINK + ENTRY POINT** |
| 19 | Integrations | Plug | Existing |
| 20 | BYOK | KeySquare | Existing |
| 21 | Help | HelpCircle | Existing |
| 22 | **Experiments** | **FlaskConical** | **NEW LINK** |
| 23 | **API Docs** | **Code** | **NEW LINK** (MASTER+) |
| 24 | **Advisor** | **Brain** | **NEW LINK** (ENTERPRISE) |

### Admin Section
| # | Link | Icon | Page Status |
|---|---|---|---|
| 25 | Admin Home | LayoutDashboard | CREATE redirect |
| 26 | Ops Dashboard | Activity | Existing |
| 27 | Activation Funnel | BarChart2 | Existing |
| 28 | Cron Monitor | ServerCog | Existing |
| 29 | Email Outbox | Webhook | Existing |
| 30 | Affiliate Leaderboard | Coins | Existing |
| 31 | Webhook Deliveries | Webhook | Existing |
| 32 | Storage Usage | Database | Existing |
| 33 | Audit Log | FileText | Existing |
| 34 | API Key Usage | KeyRound | Existing |
| 35 | Tenant Lookup | Activity | Existing |
| 36 | Cost Dashboard | Coins | Existing |
| 37 | **Licenses** | **KeyRound** | **NEW PAGE** |
| 38 | **Payouts** | **Coins** | **NEW PAGE** |
| 39 | Migrations | Database | Existing |
| 40 | E2E Smoke | FlaskConical | Existing |
| 41 | HeyGen Webhooks | Webhook | Existing |
| 42 | Deploy Status | ServerCog | Existing |
| 43 | **Actions** | **Terminal** | **NEW LINK** |
| 44 | **Invites** | **UserPlus** | **NEW LINK** |
| 45 | **Pricing** | **DollarSign** | **NEW LINK** |
| 46 | **Refunds** | **Undo2** | **NEW LINK** |
| 47 | **Handover** | **ArrowRightLeft** | **NEW LINK** |
| 48 | **Go-Live Checklist** | **CheckCircle** | **NEW LINK** |

### Account & Settings
| # | Link | Page Status |
|---|---|---|
| 49 | Account & Billing | Existing |
| 50 | Settings | Existing |
| 51 | Replay Tour | Existing |

**Total: 51 nav items** (vs current 36). Manageable with collapsible sub-groups if needed.

---

## Appendix B: API-to-Page Mapping (Complete)

### User-Facing APIs -> Pages

| API Route | Current Page | Gap? |
|---|---|---|
| `/api/agents/list` | agents (no link) | Link missing |
| `/api/agents/stream` | agents | OK |
| `/api/agents/status/[id]` | agents | OK |
| `/api/analytics/agent-performance` | None | NEW analytics tab |
| `/api/billing/usage-summary` | billing | OK |
| `/api/affiliate/clicks` | affiliate (no link) | Link missing |
| `/api/affiliate/conversions` | affiliate | OK |
| `/api/affiliate/earnings` | affiliate | OK |
| `/api/affiliate/payouts` | affiliate | OK |
| `/api/analytics/licenses` | None | NEW analytics tab |
| `/api/v1/creative-studio/images` | creative-studio | OK |
| `/api/v1/missions` | missions | OK |
| `/api/v1/campaigns` | campaigns | OK |
| `/api/v1/agent-chat` | None | Embed into agents |
| `/api/signals/experiments` | experiments (no link) | Link + bug fix |
| `/api/v1/sop/[id]` | sops | OK (trigger btn missing) |
| `/api/handover/me` | None | NEW page |
| `/api/user/billing-history` | None | Embed into billing |
| `/api/credits` | credits | OK |
| `/api/wallet` | wallet | OK |
| `/api/payments/one-time-checkout` | wallet | Verify exists |

### Admin APIs -> Pages

| API Route | Current Page | Gap? |
|---|---|---|
| `/api/admin/licenses/*` | None | NEW page |
| `/api/admin/dunning/*` | None | Extend billing |
| `/api/admin/payouts/*` | None | NEW page |
| `/api/admin/billing/*` | None | Extend billing |
| `/api/admin/refunds/*` | refunds (no link) | Link missing |
| `/api/admin/ops` | ops | OK |
| `/api/admin/funnel` | funnel | OK |
| `/api/admin/crons` | crons | OK |
| `/api/admin/email-outbox` | email-outbox | OK |
| `/api/admin/affiliate-leaderboard` | affiliate-leaderboard | OK |
| `/api/admin/webhook-deliveries` | webhook-deliveries | OK |
| `/api/admin/storage` | storage | OK |
| `/api/admin/audit-log` | audit-log | OK |
| `/api/admin/api-key-usage` | api-key-usage | OK |
| `/api/admin/tenant-lookup` | tenant-lookup | OK |
| `/api/admin/cost` | cost | OK |
| `/api/admin/migrations` | migrations | OK |
| `/api/admin/deploy-status` | deploy-status | OK |
| `/api/admin/actions` | actions (no link) | Link missing |
| `/api/admin/invites` | invites (no link) | Link missing |
| `/api/admin/pricing` | pricing (no link) | Link missing |
| `/api/admin/go-live-checklist` | go-live-checklist (no link) | Link missing |
| `/api/admin/finance/report` | finance/reports (no entry) | Entry missing |
| `/api/cron/d1-backup` | ops | OK |

---

**Plan owner:** Sophia AI Factory team  
**Review:** Before Sprint A starts  
**Test gate:** `npm run test:smoke` + `npm run test:unit` + Playwright navigation suite  
**Deploy:** Via `npm run deploy:full` after SHA attestation
