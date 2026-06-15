# Phase 03: Marketplace + Creator Mode

**Status:** In Progress
**Priority:** P0
**Depends on:** Phase 01 (engine), Phase 02 (library + tier gating)

---

## Context Links
- [Strategy Plan](./plan.md)
- [Phase 01](./phase-01-sop-engine.md) — D1 schema + executor
- [Phase 02](./phase-02-sop-library-tier-gating.md) — Library + tier gating

## Overview

Add paid SOP marketplace where MASTER-tier creators publish community SOPs, buyers purchase via NOWPayments (crypto), and creators earn 70% commission. Leverages existing commission_ledger + payout infrastructure from revenue-split migration.

## Key Insights

1. **`sop_templates.is_official`** flag + `author_user_id` already exist — community SOPs set `is_official=0`
2. **`commission_ledger`** + **`payout_batches`** + **`payout_methods`** tables already exist from `0106-revenue-split-tables.sql`
3. **NOWPayments** `createOneTimeInvoiceUrl()` pattern exists for one-time purchases
4. **`listOfficialTemplates()`** filters `is_official=1` — need `listMarketplaceTemplates()` for community SOPs
5. **Tier gating**: Only MASTER tier ($4,999 lifetime) can publish SOPs to marketplace

## Architecture

```
NEW Migration:    sop_listings (price, preview, marketplace metadata)
                  sop_licenses (purchase records per user×template)

Repo (lib/sop):   sop-repo-marketplace.ts  — listings + licenses CRUD
                  sop-repo-templates.ts    — add listMarketplaceTemplates()

Server Actions:   sop-marketplace/actions.ts — add purchaseSopAction()
                  sop-creator/actions.ts     — NEW: createSopAction, updateSopAction

Pages:            /dashboard/sop-marketplace — extend with community tab
                  /dashboard/sop-creator     — NEW: creator dashboard (MASTER only)
                  /dashboard/sop-creator/new — NEW: SOP editor form
                  /dashboard/sop-creator/[id] — NEW: edit existing SOP

Land layer:       land/sop-marketplace/commission-split.ts — 70/30 split logic
```

## D1 Migration: `20260522_sop_marketplace.sql`

```sql
-- SOP Marketplace Listings (extends sop_templates with pricing)
CREATE TABLE IF NOT EXISTS sop_listings (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL UNIQUE,
  price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  preview_md TEXT,
  demo_video_url TEXT,
  tags TEXT,                          -- JSON array
  total_sales INTEGER DEFAULT 0,
  total_revenue_cents INTEGER DEFAULT 0,
  rating_avg REAL DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  status TEXT CHECK(status IN ('pending_review','published','rejected','suspended')) NOT NULL DEFAULT 'pending_review',
  rejection_reason TEXT,
  published_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- SOP Purchase Licenses
CREATE TABLE IF NOT EXISTS sop_licenses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  listing_id TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  payment_id TEXT,                    -- NOWPayments order_id
  payment_status TEXT CHECK(status IN ('pending','paid','refunded')) NOT NULL DEFAULT 'pending',
  purchased_at INTEGER NOT NULL,
  refunded_at INTEGER,
  UNIQUE(user_id, template_id)
);

CREATE INDEX IF NOT EXISTS idx_listing_status ON sop_listings(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_listing_template ON sop_listings(template_id);
CREATE INDEX IF NOT EXISTS idx_license_user ON sop_licenses(user_id, template_id);
CREATE INDEX IF NOT EXISTS idx_license_listing ON sop_licenses(listing_id, payment_status);
```

## Tasks

### Task A: D1 Migration + Types (seed layer)
- [ ] Create migration `migrations/20260522_sop_marketplace.sql`
- [ ] Add `SopListingRow`, `SopLicenseRow` types to `lib/sop/sop-types.ts`
- **Files:** `src/seed/db/migrations/`, `src/lib/sop/sop-types.ts`

### Task B: Marketplace Repository (lib/sop)
- [ ] Create `src/lib/sop/sop-repo-marketplace.ts` — listings + licenses CRUD
  - `getListingByTemplateId(db, templateId)`
  - `listPublishedListings(db, opts: { category?, limit?, offset? })`
  - `createListing(db, input)`
  - `updateListingStatus(db, id, status, reason?)`
  - `incrementSales(db, listingId, priceCents)`
  - `createLicense(db, input)`
  - `getUserLicense(db, userId, templateId)`
  - `listUserLicenses(db, userId)`
- [ ] Add `listMarketplaceTemplates(db)` to `sop-repo-templates.ts`
- [ ] Re-export from `sop-repo.ts` barrel
- **Files:** `src/lib/sop/sop-repo-marketplace.ts`, `src/lib/sop/sop-repo-templates.ts`, `src/lib/sop/sop-repo.ts`

### Task C: Commission Split Logic (land layer)
- [ ] Create `src/land/sop-marketplace/commission-split.ts`
  - `calculateCreatorCommission(priceCents)` → { creatorCents, platformCents } (70/30)
  - `recordSopSaleCommission(db, { creatorId, listingId, priceCents, paymentId })` → writes to existing commission_ledger
- **Files:** `src/land/sop-marketplace/commission-split.ts`

### Task D: Creator Dashboard Pages (MASTER tier only)
- [ ] Create `/dashboard/sop-creator/page.tsx` — list creator's published SOPs + sales stats
- [ ] Create `/dashboard/sop-creator/new/page.tsx` — SOP creation form
- [ ] Create `/dashboard/sop-creator/actions.ts` — createSopAction, updateSopAction, submitForReviewAction
- [ ] Creator form fields: name_vi, name_en, description, category, agents_yaml, playbook_md, config_schema, price
- [ ] Tier gate: redirect non-MASTER users to /pricing
- **Files:** `src/app/[locale]/dashboard/sop-creator/`

### Task E: Marketplace UI Extensions
- [ ] Add community SOPs tab/section to marketplace page
- [ ] Show price badge on community SOP cards
- [ ] "Buy" button for unpurchased community SOPs → NOWPayments checkout
- [ ] "Purchased" badge for owned community SOPs
- [ ] Add `purchaseSopAction` to marketplace actions
- [ ] i18n keys for marketplace purchase flow (en + vi)
- **Files:** `src/app/[locale]/dashboard/sop-marketplace/`, `src/forest/components/sop/`, `messages/`

## File Ownership (Parallel Agents)

| Agent | Owns | Reads |
|-------|------|-------|
| Agent A (Schema) | `migrations/`, `lib/sop/sop-types.ts` | — |
| Agent B (Repo) | `lib/sop/sop-repo-marketplace.ts`, `lib/sop/sop-repo-templates.ts`, `lib/sop/sop-repo.ts` | sop-types.ts |
| Agent C (Land) | `land/sop-marketplace/` | sop-types.ts, commission_ledger schema |
| Agent D (Creator UI) | `app/[locale]/dashboard/sop-creator/` | sop-types.ts, tiers, auth |
| Agent E (Marketplace UI) | `app/[locale]/dashboard/sop-marketplace/page.tsx`, `forest/components/sop/`, `messages/` | sop-repo, sop-types |

## Success Criteria
- [ ] Migration applies cleanly
- [ ] MASTER users can create + publish SOPs
- [ ] Community SOPs appear in marketplace with pricing
- [ ] Purchase flow creates license + commission ledger entry
- [ ] `npm run build` passes
- [ ] tsc clean

## Risk Assessment
- **NOWPayments invoice**: Each SOP needs a unique invoice or dynamic pricing — may need API-based invoice creation vs pre-created IDs
- **Review queue**: Phase 3 uses `pending_review` status but no admin review UI yet — auto-publish for MVP
- **Refund policy**: sop_licenses has refunded_at but no refund flow — Phase 4+
