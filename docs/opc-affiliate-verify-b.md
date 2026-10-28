# Sophia OPC Affiliate Audit — "B" Platform Groups Verification

- Worktree: `/Users/macbook/sophia-opc-audit`
- App root: `/Users/macbook/sophia-opc-audit/apps/sophia-ai-factory`
- Base commit: `439635e1a2017c2643e013c0311631bd95409de4`
- Mode: read-only source inspection. No files edited, no builds, no tests run.
- Method: every verdict below is based on quoted source lines and grep-verified caller
  traces. Where a claim could not be traced to production behavior it is marked
  BLOCKED or NOT VERIFIED rather than PASS.

---

### B02 — operator self-connects a network account

- **Invariant:** The codebase claims a customer can connect their own affiliate network
  account (BYOK for affiliate networks per the no-tech doctrine) and that the connection
  state is persisted encrypted per tenant. Matched against doctrine in
  `CLAUDE.md`: "Affiliate network keys (Awin, ShareASale, etc.) -> customer enters".
- **Entrypoint:** `apps/sophia-ai-factory/src/app/api/v1/integrations/affiliate-networks/route.ts:36` (GET) and `:62` (POST), delegating to
  `src/land/affiliates/credentials.ts` (re-export of `src/tree/affiliates/credentials/storage.ts`)
  at line 82:
  ```ts
  await saveCredentials(db, user.id, network, parsed.data.payload as unknown as NetworkCredentialPayload[typeof network]);
  ```
- **Production callers:** NONE. `grep -rn "integrations/affiliate-networks" src` returns only
  the route file's own docstring. No UI component, server action, or page fetches this route.
  The Setup Wizard has no affiliate-network step (steps are api-keys, provider-credentials,
  payment, review, finish). `messages/vi.json` has a `/dashboard/integrations` namespace with
  connect copy, but the only existing integrations page is
  `src/app/[locale]/admin/integrations/page.tsx`, and
  `grep -rn "affiliate" src/app/[locale]/admin/integrations/` returns nothing.
- **Observed:**
  Storage layer is real. `src/tree/affiliates/credentials/storage.ts` inserts into
  `affiliate_network_credentials` with `encryptToken(json)`, and schema exists at
  `migrations/0084-affiliate-network-credentials.sql`:
  ```sql
  CREATE TABLE IF NOT EXISTS affiliate_network_credentials (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    network TEXT NOT NULL CHECK(network IN (
      'impact_radius','partnerstack','cj','shareasale','clickbank',
      'binance','bybit','bitget','coinbase'
    )),
    encrypted_credentials TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','invalid','rate_limited')),
    ...
  ```
  and is extended by `migrations/0248-extend-credential-network-types.sql`.
  Read path is real too — `listNetworks(db, user.id)` drives the GET response.
  But nothing in the product reaches it. Two additional defects:
  1. Tenant scoping mismatch — the credentials route uses `user.id` as tenant
     (`route.ts:44`, `route.ts:82`) while reconciliation uses
     `resolveOrgId(user.id, db) ?? user.id` (`page.tsx:44-45`). A customer in an org
     would have their credentials written under a different tenant key than the one
     reconciliation reads.
  2. `route.ts:76-80` documents a deliberate loose-typing bridge: the payload is
     `z.record(z.string(), z.string())` cast via `unknown` to a strict per-network type,
     so no per-network shape is actually validated before encryption.
- **Verdict:** FAIL
- **Severity:** high
- **Repro:** read-only source inspection; `grep -rn "integrations/affiliate-networks" src` returns only the route's own docstring.
- **Remediation:** Build a customer-facing connections surface (Setup Wizard step or
  `/dashboard/integrations` affiliates section) that POSTs to this route; align the
  tenant key with `resolveOrgId`; replace the `z.record` payload with a per-network
  discriminated schema.

---

### B03 — picked offer persists into a campaign

- **Invariant:** A discovered affiliate offer, once picked by the customer, becomes a
  durable campaign record that the video pipeline can act on.
- **Entrypoint:** `src/land/affiliates/actions/discover-offers-action.ts:51`
  (`discoverAffiliateOffersAction` -> `runAgenticDiscoveryWave` at line 81) and
  `src/land/affiliates/actions/convert-offer-action.ts:37`
  (`convertOfferToCampaignAction` -> `convertOfferToCampaign(parsed.data.offer, {...})` at line 61).
  The bridge is `src/land/affiliates/campaign-bridge.ts:43`.
- **Production callers:** NONE for both server actions. `grep -rn
  "discoverAffiliateOffersAction\|convertOfferToCampaignAction" src` outside the defining
  files returns only `__tests__/discover-offers-action.test.ts` and
  `__tests__/convert-offer-action.test.ts`.
  A second, non-action path exists but is also clientless:
  `src/app/api/affiliate-discovery/affiliate-discovery-helpers.ts:117` calls
  `runAgenticDiscoveryWave` in its POST handler, but no UI component fetches
  `/api/affiliate-discovery` — the only non-test references are
  `src/seed/guide/guide-backend-catalog.ts:55` (a sample command) and
  `src/tree/aeo/resolve-aeo-route.ts:77`.
  The Stitch panel that would hold the picked offer in state,
  `src/components/stitch/screens/affiliates/discovery/use-affiliate-discovery.ts`, is not
  mounted in any route (grep for non-stitch importers of `stitch/screens` returned nothing).
- **Observed:** The conversion logic is written and unit-tested, but it stops at a list.
  `use-affiliate-discovery.ts` holds `selectedOffer` as client state only, with no
  persistence call. Neither server action has a production caller, so no offer ever
  reaches `convertOfferToCampaign` from the product. Consequently no campaign record
  is created by the offer path at all.
- **Verdict:** FAIL
- **Severity:** high
- **Repro:** read-only source inspection; `grep -rn "convertOfferToCampaignAction" src` outside the definition and its test returns nothing.
- **Remediation:** Mount a discovery/pick UI, wire it to
  `convertOfferToCampaignAction` (or the `/api/affiliate-discovery` POST), and confirm a
  campaign row is written to D1 before calling this group complete.

---

### B05 — job failures surface to the operator

- **Invariant:** Failures in the video generation and publish chain should be visible to
  the operator rather than silently stalling.
- **Entrypoint:** `src/forest/inngest/functions/niche-video-dispatcher.ts:31` (registered as
  `nicheVideoDispatcher` in `GROWTH_INNGEST_FUNCTIONS` at
  `src/app/api/inngest/serve/growth-functions.ts:52`), triggered by
  `{ event: 'niche.video.campaign.requested' }`. Client dispatch is
  `src/forest/actions/niche-video-actions.ts` via `dispatchNicheVideoCampaignAction`.
- **Production callers:** `niche-video-dispatcher` — registered via
  `growth-triad-registry.ts:8` (`export * from './niche-video-dispatcher'`). Three
  related helpers have no callers at all:
  - `src/forest/social/syndication-manager.ts:13` `scheduleSyndicationJob` — listens to
    the same event and emits `publish.scheduled`, but grep returns only its own
    definition, so it is never registered or invoked.
  - `src/land/affiliates/commission-dlq.ts:30` `enqueueCommissionDlq` — definition only.
  - `src/land/affiliates/affiliate-live-metrics.ts:9` `loadLiveAffiliateMetrics` —
    definition only.
- **Observed:** The dispatcher terminates before any render or publish:
  ```ts
  return {
    status: 'RENDER_READY',
    summary: stageSummary,
    plan, script, voiceover, manifest,
  };
  ```
  (`niche-video-dispatcher.ts:173-179`). From `dispatchNicheVideoCampaignAction` onward the
  chain is: dispatch event -> `RENDER_READY` -> no render step -> no publish step ->
  no failure record. The only error text anywhere on the affiliates dashboard is the
  kill-switch toggle's own local failure state (`AffiliateCockpitView.tsx:26,42,71`):
  ```ts
  {errorMessage && <p className="text-xs text-destructive font-medium">{errorMessage}</p>}
  ```
  There is no read path for `error_log`, no staleness surfacing, and no alert for a
  RENDER_READY job that never renders. A failed or stalled job is invisible.
- **Verdict:** FAIL
- **Severity:** critical
- **Repro:** read-only source inspection; `grep -rn "scheduleSyndicationJob\|enqueueCommissionDlq\|loadLiveAffiliateMetrics" src` returns definitions only.
- **Remediation:** Register `scheduleSyndicationJob`, add a render/publish continuation
  (or an explicit failure branch after RENDER_READY), wire `enqueueCommissionDlq` and
  `loadLiveAffiliateMetrics` into real callers, and surface stalled/failed jobs on the
  affiliates dashboard.

---

### B07 — reconciliation reads real ledger rows

- **Invariant:** (a) commission lifecycle is `pending -> approved -> reversed ->
  paid_receipt` with deterministic precedence when records arrive out of order;
  (b) the aggregate should reflect real ledger rows for the workspace, tenant-isolated;
  (c) when no FX rate exists, totals stay segregated per currency rather than being summed
  at a fabricated rate; platform fee strictly 0.
- **Entrypoint:** `src/land/affiliates/reconciliation/workspace-domain-b-reconciliation.ts:65`
  (`computeDomainBReconciliation`) and `:171`
  (`fetchWorkspaceDomainBReconciliation`).
- **Production callers:** `src/app/[locale]/dashboard/affiliates/page.tsx:54-57` (real call
  passing raw D1) and `src/land/affiliates/dashboard/affiliate-cockpit-service.ts:15`
  (type-only import). The writer side is also live:
  `src/app/api/postback/[network]/core/route-handler.ts:7` imports and line 138 invokes
  `processSaasCryptoPostback`, gated at line 12 by
  ```ts
  const DOMAIN_B_NETWORKS = new Set<string>(['partnerstack', 'rewardful', 'binance', 'binance-link', 'bybit']);
  ```
- **Observed:**
  (a) The precedence map and lifecycle are exactly as claimed (lines 58-63):
  ```ts
  const STATUS_SEVERITY: Record<DomainBCommissionRecord['status'], number> = {
    pending: 1,
    approved: 2,
    reversed: 3,
    paid_receipt: 4,
  };
  ```
  Tenant isolation is enforced at line 75 (`if (rec.tenantId !== workspaceId) continue;`)
  and dedup is keyed `${rec.network}:${rec.externalTxId}` with severity-wins then
  `occurredAt` tie-break. Math is sound: `platformFeeCents: 0` at line 164, and
  `effectiveCommissionCents = totalApprovedUnpaidCents + totalPaidReceiptCents` (line 155)
  correctly excludes pending and reversed. This part is L1-correct.
  (b) It issues a genuine SELECT, not a placeholder (lines 176-188):
  ```sql
  SELECT id, tenant_id as tenantId, network, external_tx_id as externalTxId,
         gross_amount_cents as grossAmountCents, commission_cents as commissionCents,
         status, currency, occurred_at as occurredAt
  FROM workspace_external_commissions
  WHERE tenant_id = ?
  ORDER BY occurred_at ASC
  ```
  (c) Currency segregation is unconditional and requires no FX rate (lines 105-116):
  `const curr = (rec.currency || 'USD').toUpperCase();` then a per-currency
  `byCurrency[curr]` bucket. No FX conversion path exists anywhere in the reconciliation
  module, so no fabricated-rate summation can occur. This claim conforms.
  **Blocking defect:** the target table does not exist. Repo-wide,
  `grep -rln "workspace_external_commissions"` returns only 5 non-migration files — the
  reader, the writer (`saas-crypto-postback-service.ts`), and 3 test files. There are 433
  files in `apps/sophia-ai-factory/migrations/` and
  `grep -rln "external_commissions" apps/sophia-ai-factory/migrations` returns nothing.
  The nearest analog, `0452_affiliate_ecosystem_ledger.sql`, creates a different table
  (`affiliate_commissions`). The writer's comment at
  `saas-crypto-postback-service.ts:70` cites "migration 0480" for its dedup constraint,
  which is factually wrong — `0480_auth_2027_clean_slate.sql` contains no such table.
  In production the SELECT throws, `fetchWorkspaceDomainBReconciliation` returns
  `failure`, and `page.tsx:57` sets `domainBSummary: undefined`, then `page.tsx:73-86`
  swallows it:
  ```ts
  } catch {
    tenantId = user.id;
  }
  ```
  returning `metrics: EMPTY_AFFILIATE_METRICS, killSwitchActive: false`. All figures render
  as zero with no error shown — the UI's `domain-b-empty-state` branch renders
  `t.emptyLedgerText`, so an absent table is visually indistinguishable from a genuinely
  empty ledger.
- **Verdict:** BLOCKED (math and precedence PASS at L1; the production read path cannot
  succeed because the table has no migration)
- **Severity:** high
- **Repro:** read-only source inspection; `grep -rln "external_commissions" apps/sophia-ai-factory/migrations` returns nothing against 433 migration files.
- **Remediation:** Add the `workspace_external_commissions` DDL migration and apply it to
  `sophia-raas-db`; correct the stale "migration 0480" comment; make the
  `catch {}` at `page.tsx:73-86` surface a real error instead of silently emitting all-zero
  metrics.

---

### B08 — one workspace, all six nav groups

- **Invariant:** A single operator dashboard exposes six nav groups — Hôm nay (Today) /
  Offers / Chiến dịch (Campaigns) / Cần duyệt (Approvals) / Kết quả (Results) / Kết nối
  (Connections) — with approval queue, results, and connections all reachable from one page.
- **Entrypoint:** `src/app/[locale]/dashboard/affiliates/page.tsx:89`
  (`AffiliatesDashboardPage`).
- **Production callers:** the page itself, via the `[locale]` route segment.
- **Observed:** None of the six nav groups exist. `grep -rn "Cần duyệt" src` returns zero
  nav-related hits; `grep -rn "Hôm nay" src` returns three unrelated matches (an email
  template and two script templates). `Kết nối` hits are unrelated strings.
  The page renders: a bilingual header (`page.tsx:111-120`), `AffiliateCockpitView`
  (`:123`), 3 KPI cards (`:129-165`), and `AffiliateHookRankingTable` (`:168`).
  Two of the three KPI cards are structurally always zero because
  `EMPTY_AFFILIATE_METRICS` is spread in and never overridden
  (`src/app/[locale]/dashboard/affiliates/affiliates-dashboard-sections.ts:15`):
  ```ts
  metrics: {
    ...EMPTY_AFFILIATE_METRICS,
    totalCommissionUsd,
  },
  ```
  leaving `totalBridgeClicks` and `totalVideosGenerated` hardcoded at 0, under labels
  promising "Bridge Page Clicks" and "Syndicated Videos". The hook ranking table is
  rendered with no `hooks` prop, so it is permanently in an empty state. There is no
  approval queue (the `DRAFT_PENDING_CEO_APPROVAL` branch that exists in the dispatcher
  at `niche-video-dispatcher.ts:112` is never surfaced), no results section beyond the
  three cards, and no connections surface. The related route
  `src/app/[locale]/dashboard/affiliates/portal/page.tsx` merely redirects, and
  `src/app/components/affiliate/dashboard/partner-dashboard-tabs.tsx` offers 3 tabs
  (`links` / `assets` / `payouts`) — not the six named groups.
- **Verdict:** FAIL
- **Severity:** high
- **Repro:** read-only source inspection; `grep -rn "Cần duyệt" src` returns zero hits.
- **Remediation:** Implement the six nav groups, populate the two always-zero KPI cards
  from real telemetry, pass real hook data to `AffiliateHookRankingTable`, and surface
  the pending-approval queue on the page.

---

## Status

Status: DONE_WITH_CONCERNS
Summary: All five B groups fail on traced production behavior rather than on code
absence: B02 has a real encrypted credential store and headless API with no reachable UI
and a tenant-scoping mismatch; B03 has tested actions with zero production callers so
offers stop at a list; B05's dispatcher ends at `RENDER_READY` with unregistered
syndication and no error surfacing; B08 has none of the six nav groups and two KPI cards
hardcoded to zero.
Concerns/Blockers:
- B07's ledger table `workspace_external_commissions` has no migration in 433 migration
  files, so the B07 read throws in production and `page.tsx:73-86` converts the failure
  into silent all-zero metrics. This is the highest-leverage single fix in the group.
- Per the no-pass-from-existence rule, B07 is reported BLOCKED, not PASS, even though its
  L1 math, precedence map, and per-currency segregation are correct.
- No builds, tests, or migrations were run, and no file was modified, per the read-only
  instruction.
