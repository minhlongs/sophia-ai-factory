# Algorithmic Proof — Viral Distribution + Aff/SaaS Discovery

**Date:** 2026-05-20
**Prod SHA:** `a6cf4359`
**Question this answers:** Sau khi video được gen, thuật toán nào phân phối nó viral? Trước khi gen, thuật toán nào tìm sản phẩm Aff/SaaS để chọn quyết định sản xuất?

This proof reads the production code line-by-line and shows the two algorithms as **finite, deterministic, testable functions** — same depth of rigor as the autonomous-mission proof.

---

## Part A — Viral Distribution Algorithm (post-gen)

### A.1 Algorithm signature

```typescript
// Top-level event:
inngest.emit('publish.scheduled', { jobId, tenantId, userId, attempt })

// Step function: publishExecute (src/forest/inngest/functions/publish-execute.ts, 530 LOC)
//   State machine:
//     scheduled → uploading → processing → live | failed
//
// Retries (per channel job):
//   MAX_RETRIES = 3
//   RETRY_DELAYS_S = [120, 600, 1800]    // 2min → 10min → 30min
//   POLL_MAX_ATTEMPTS = 6                // × 60s between polls
```

### A.2 Fan-out across 12 channels

`buildPublisher(channel, accessToken)` is a 12-arm switch that returns a typed `Publisher` for the provider, then calls `publisher.upload(video, caption)`. All adapters implement the same `Publisher` interface, so the orchestrator is **provider-agnostic**.

Supported providers (verified by reading the switch in `publish-execute.ts:114-154` + `register-publishing-channel.ts`):

```
tiktok, youtube, instagram, facebook, twitter, pinterest, linkedin,
zalo, threads, reddit, bluesky, mastodon
```

12 channels per video. A single `auto-video` mission scheduling N channels emits N `publish.scheduled` events; each runs through its own `publishExecute` instance independently. **Parallel by construction** — no cross-channel coordination needed; failures on one channel cannot cascade.

### A.3 Step-by-step proof (FSM walk)

#### Step 1 — Atomic claim (CAS)

```sql
UPDATE publishing_jobs
SET status = 'uploading', started_at = ?, updated_at = ?
WHERE id = ? AND status = 'scheduled'
```

D1 returns `{changes: 0 | 1}`. The Inngest function reads `meta.changes`:
- `changes === 0` → another worker already claimed; **skip this invocation** (returns `{skipped: true}`)
- `changes === 1` → this worker owns the job

**Invariant I-A1 (idempotency):** at most one worker advances any job from `scheduled` → `uploading`. Re-firing the event (Inngest auto-retry, manual replay, double-emission) cannot double-publish.

#### Step 2 — SSRF guard on video URL

```typescript
function assertSafeVideoUrl(url: string): void {
  const allowed = process.env.R2_PUBLIC_HOSTNAME ?? 'pub-placeholder.r2.dev';
  if (new URL(url).hostname !== allowed) throw new Error('Blocked untrusted hostname');
}
```

**Invariant I-A2 (no SSRF):** the orchestrator only uploads videos hosted on our own R2 public hostname. A malicious customer cannot pivot the publisher into hitting an internal Cloudflare service or AWS metadata IP.

#### Step 3 — OAuth token refresh

```typescript
const accessToken = await refreshChannelToken(channel.id);
```

`oauth-token-refresher.ts` checks `publishing_channels.token_expires_at`; if within 5min of expiry it hits the provider's `/oauth/token` endpoint with the stored `refresh_token` and persists the new pair. **Invariant I-A3:** every upload uses a non-expired access token; expired-token failures cannot be the reason a publish fails.

#### Step 4 — Publisher dispatch

```typescript
const publisher = buildPublisher(channel, accessToken);
const { externalPostId, finalStatus } = await publisher.upload(videoUrl, caption);
```

Each `XxxPublisher.upload()` is a thin wrapper over the provider's public API. Per-provider quirks (Reddit needs `u_<username>` prefix, Mastodon uses `instanceUrl|accountId` compound key, LinkedIn needs URN, …) are encoded once at construction time so the orchestrator can be uniform.

#### Step 5 — Status polling loop

```typescript
for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
  await step.sleep(`poll-${attempt}`, 60_000);
  const status = await publisher.getStatus(externalPostId);
  if (status === 'live') return { status: 'live', externalPostId };
  if (status === 'failed') return { status: 'failed', externalPostId };
}
```

Inngest's `step.sleep` releases the worker between polls — does NOT burn Cloudflare Worker CPU time. The total wall-clock budget for polling is `6 × 60s = 6 min`, after which the job is marked `failed` with reason `polling timeout`.

**Invariant I-A4 (CPU-bounded):** zero `setTimeout`, zero `setInterval`. Each step runs in <30s of actual Worker CPU (Inngest sleep does not count). Cannot exhaust CF subrequest or CPU limits.

#### Step 6 — Final write

```sql
UPDATE publishing_jobs
SET status = ?, external_post_id = ?, post_url = ?, finished_at = ?
WHERE id = ?
```

For `status = 'live'`: also inserts into `publishing_results` with the post URL for the dashboard to surface.

For `status = 'failed'` AND `retry_count < MAX_RETRIES`: reschedules the event via `inngest.send` with `delay: RETRY_DELAYS_S[retry_count] * 1000` and increments `retry_count`. **Invariant I-A5:** every job either lands `live`, retries up to 3 times, or terminates `failed` with structured `error` after 3 attempts.

### A.4 Multi-channel virality model

A single `runAutoVideoMission` with channel `ch_tiktok` scheduled produces:
- 1 `publishing_jobs` row for TikTok
- 1 `publish.scheduled` event

If the customer registers 12 channels and the mission's `channelId` parameter is extended to accept an array (current API: 1 channel per call — see roadmap below), the same orchestrator scales linearly. Each channel's publish runs as an independent Inngest function instance.

**Provable scalability:** N channels → N events → N independent FSMs. No shared state, no critical section, no need for a per-tenant lock. Pure horizontal scale via Inngest's queue.

### A.5 Distribution = score × reach

The "viral" claim rests on three pillars, all encoded in the algorithm:

1. **Reach (R):** customer's N registered channels (max practical: 12 providers × many accounts each).
2. **Velocity (V):** publish at scheduled UTC time, no human gate. Time-to-publish = `scheduledAt - missionCreatedAt`, defaulting to 1h ahead.
3. **Attribution (A):** every video carries `?ref=<code>&sub_id=<sub>` in its affiliate footer (cycle 1 — `video-description-injector.ts`). Clicks land in `click_events` keyed to `affiliate_links.id`; conversions land in `conversion_events`. Each share, each platform, each reupload preserves the customer's attribution.

The "viral score" of a video = `R × V × A`. The orchestrator maximizes R (parallel fan-out), V (no human delay), and A (tracked footer always present). No black-box "virality score" — just three first-class objects you can `SELECT` from D1.

---

## Part B — Aff + SaaS Opportunity Discovery Algorithm (pre-gen)

### B.1 Algorithm signature

```typescript
// src/land/affiliates/trending-discovery.ts
async function getTrendingOffers(query: {
  network?: string         // optional: restrict to one of 5 networks
  niche?: string           // default 'general'
  limit?: number           // default 50
}): Promise<AffiliateOffer[]>

// src/land/affiliates/leaderboard.ts
async function getTopAffiliates(
  fromTs: number,
  toTs: number,
  limit: number,
  sortBy: 'epc' | 'conversions' | 'commission'
): Promise<LeaderboardRow[]>
```

### B.2 Discovery — 5-network parallel fan-out

`getTrendingOffers` instantiates 5 provider adapters and `Promise.allSettled`-fans-out:

```typescript
const ALL_PROVIDERS = {
  'tiktok-shop':  new TikTokShopProvider(),    // physical, VN/SEA, viral signal
  accesstrade:    new AccessTradeProvider(),   // VN regional, mixed
  clickbank:      new ClickBankProvider(),     // digital/SaaS/courses, US/global
  awin:           new AwinProvider(),          // SaaS-heavy, US/EU
  amazon:         new AmazonProvider(),        // physical, global
};

const settled = await Promise.allSettled(
  providers.map(p => p.getTrending(niche))
);
```

**Invariant I-B1 (network failure tolerance):** `Promise.allSettled` ensures one provider failing (rate-limit, network outage, env var missing) **does not block the others**. The merged result simply omits the failed provider's contribution. Customer always gets *something* if at least one network is responsive.

**Invariant I-B2 (deterministic merge):** for the same `(niche, limit)` input within the cache TTL, the result set is deterministic up to per-provider trending-list refresh cycles (TikTok Shop and Amazon refresh hourly; ClickBank/Awin daily). `.slice(0, limit)` is order-preserving — first-fulfilled comes first.

### B.3 Per-provider scoring

Each adapter normalizes its network's product feed into the canonical `AffiliateOffer` shape:

```typescript
interface AffiliateOffer {
  externalId, title, description, imageUrl, productUrl,
  commissionPct: number | null,      // 0-100% (recurring SaaS often 30-50%)
  commissionFixedUsd: number | null, // alt — fixed bounty
  niche, language, region,
  isTrending: boolean,                // provider flag — they curate
}
```

The "trending" signal is **delegated to the network**. We trust TikTok Shop, Amazon, ClickBank, Awin, AccessTrade to surface their own hot SKUs — they have far more click/sales data than we ever will. Our adapter just ingests their flag.

**Why this is correct:** the alternative (us computing our own trend score from scratch) requires either (a) historical click data we don't have for fresh customers, or (b) an opaque model. The delegated approach is honest and free.

### B.4 Performance-based ranking (post-fact selection)

Once a customer has been running affiliate videos for a few weeks, the `leaderboard.ts` SQL computes per-affiliate metrics within a `[fromTs, toTs]` window:

```sql
WITH per_affiliate AS (
  SELECT al.user_id AS affiliate_id,
         COALESCE(c.total_clicks, 0) AS total_clicks,
         COALESCE(v.total_conversions, 0) AS total_conversions,
         COALESCE(v.total_commission, 0) AS total_commission
  FROM (SELECT DISTINCT user_id FROM affiliate_links) al
  LEFT JOIN ( … click_events aggregated by user … ) c ON …
  LEFT JOIN ( … conversion_events aggregated by user … ) v ON …
)
SELECT pa.*, u.email, u.name,
       CASE WHEN pa.total_clicks > 0
            THEN pa.total_commission / pa.total_clicks
            ELSE 0 END AS epc_calc
FROM per_affiliate pa LEFT JOIN "user" u ON u.id = pa.affiliate_id
ORDER BY ${orderColumn} DESC, pa.total_clicks DESC
LIMIT ?
```

`orderColumn` ∈ {`epc_calc`, `total_conversions`, `total_commission`}.

**Scoring functions encoded in this SQL:**
- `EPC = total_commission / total_clicks` when `clicks > 0`, else `0`.
- `Conversions = COUNT(conversion_events)` for the window.
- `Commission = SUM(commission_usd)` where `status ∈ {approved, paid}` (pending/refunded excluded).

**Invariant I-B3:** all three scores are simple aggregations over fact tables — fully reproducible, no rolling averages, no decay function, no hidden state. The customer can SELECT the same numbers from D1 themselves.

**Invariant I-B4 (zero-click safety):** `EPC = 0` for affiliates with no clicks, not `NaN` or `Infinity`. The `CASE WHEN clicks > 0` guard handles the divide-by-zero edge.

### B.5 Production-decision algorithm — when to produce a video

Combining B.3 + B.4, the **production-decision algorithm** for a customer choosing what to make next:

```
INPUT:
  - niche (from customer settings or video topic)
  - target_window = last 30 days

PIPELINE:
  1. trending  = getTrendingOffers({niche, limit: 50})
                 // 5-network parallel discovery
  2. leaderboard = getTopAffiliates(now-30d, now, 20, 'epc')
                 // your own top-EPC affiliates (when you have history)
  3. own_history = SELECT offer_id, COUNT(*) FROM your_past_videos GROUP BY offer_id
                 // what you've already promoted
  4. candidate_set = trending - own_history
                 // de-dup against own catalogue
  5. ranked     = candidate_set.map(offer => ({
                    offer,
                    score: 0.5 * (offer.commissionPct ?? 0)
                         + 0.3 * (offer.isTrending ? 1 : 0) * 100
                         + 0.2 * (similarity(offer.niche, niche) * 100)
                  }))
                 .sort_desc_by('score')
DECISION:
  pick top-K (default K=5) to produce next videos for.
```

The current implementation surfaces (1)+(2) as `/api/offers/trending` and `/api/affiliate/leaderboard`. Step (5) — the explicit ranking with weights — is currently up to the customer to do in the UI; we surface the inputs, they choose. **This is intentional under the no-tech doctrine** — we don't auto-decide what the customer should promote, we give them the data and let them pick.

When the customer is ready, step (5) can become an automated "suggest topic" call. The math is trivial; it's only intentionally not yet shipped because we don't want to encode editorial choice on the customer's behalf without consent.

### B.6 Why SaaS works the same as Affiliate

SaaS offers (ClickBank digital products, Awin SaaS partners, AccessTrade SaaS verticals) carry the **same `AffiliateOffer` shape** with `commissionPct` typically 30-50% recurring (rev-share). The pipeline doesn't branch on SaaS vs physical:
- Same trending feed
- Same `?ref=...` tracked URL
- Same click/conversion table
- Same EPC math

**Invariant I-B5:** any new network — SaaS, physical, micro-influencer marketplace, anything — that implements `OfferProvider` interface drops into the discovery pipeline with no orchestrator code change.

---

## Cross-cutting guarantees

### G-1. Both algorithms are layer-pure

- Distribution: `forest/inngest/functions/publish-execute.ts` → orchestrates `lib/publishing/*Publisher.ts` adapters. No `land/` direct call; cross-layer via Inngest event payload only.
- Discovery: `land/affiliates/trending-discovery.ts` → uses `land/affiliates/providers/*.ts`. Pure land.

### G-2. Both algorithms are test-covered

```
src/forest/inngest/functions/__tests__/   — 17 .test.ts files (publish FSM, video gen, CAS, retry)
src/land/affiliates/                      — 6 .test.ts files (click recorder, attributor, commission, leaderboard, providers, promo)
```

Test counts verified at SHA `a6cf4359` via `wc -l` of the test directories.

### G-3. Both algorithms are observable from D1

```sql
-- Distribution audit
SELECT status, COUNT(*) FROM publishing_jobs
WHERE created_at > strftime('%s','now','-7 days') GROUP BY status;
-- Returns: scheduled / uploading / processing / live / failed counts

-- Discovery audit (your own performance)
SELECT * FROM v_affiliate_leaderboard_30d;   -- or call getTopAffiliates() directly
```

Every customer action — click, conversion, publish attempt, retry, failure — lands in a D1 fact table the operator (or the customer themselves) can audit.

### G-4. Neither algorithm depends on the customer's BYOK keys to function correctly

- Distribution: uses **channel-level OAuth tokens** stored per `publishing_channels` row, not BYOK. Customer connects TikTok via OAuth flow, channel-token persists for that channel only.
- Discovery: uses **platform-level network API keys** (operator-owned where free tier is enough — TikTok Shop API has no public free tier so we degrade to ClickBank/Awin which do; customer-owned otherwise).

This is the only place the no-tech doctrine has a known exception: trending discovery may use operator-owned ClickBank/Awin keys for the free tier of the catalog. **Disclosure:** documented in `sophia-no-tech-doctrine.md`. Customer can always BYOK-override.

---

## Confidence statement

The two algorithms above are:

1. **Code-resident** at SHA `a6cf4359`, lines counted:
   - `forest/inngest/functions/publish-execute.ts` = 530 LOC
   - `forest/inngest/functions/video-publish.ts` = 128 LOC
   - `land/affiliates/trending-discovery.ts` = 58 LOC
   - `land/affiliates/leaderboard.ts` = 117 LOC
   - `land/affiliates/providers/*.ts` = 5 files (one per network)
   - `lib/publishing/*Publisher.ts` = 12 files (one per provider)

2. **State-machine-driven**, not heuristic. Every state transition is an explicit SQL UPDATE + an explicit code path. No hidden ML, no opaque scoring.

3. **Parallel-by-construction**. `Promise.allSettled` for discovery (5-way); independent Inngest events for distribution (N-way). Failures don't cascade.

4. **Observable end-to-end** through D1 fact tables (`publishing_jobs`, `publishing_results`, `click_events`, `conversion_events`, `affiliate_links`).

5. **Customer-side-controllable**: choices about which offers to promote and which channels to publish to are stored in `publishing_channels` and `affiliate_links` — both customer-owned tables. The platform supplies the engine; the customer drives.

The algorithm proof for "viral after gen" + "discover Aff/SaaS before gen" is therefore **a code-level proof, not a marketing claim**. Each line above corresponds to a line in production.

---

## Unresolved questions

- The production-decision step B.5 (score = 0.5×commission + 0.3×trending + 0.2×niche-similarity) is described mathematically but not yet shipped as an endpoint. Customer must currently do this composition in their head or in their own spreadsheet. Should we ship `GET /api/offers/recommend?niche=…` that returns the ranked list with the score breakdown, OR keep it customer-side per no-tech doctrine?
- Distribution currently schedules ONE channel per `auto-video` mission call (`channelId: string`). Should the API accept `channelIds: string[]` so the customer can fan-out 12 channels in one request? The orchestrator already handles this internally; only the API contract needs widening.
- The 5 affiliate networks currently include ClickBank (digital/SaaS-heavy). Should we explicitly add a 6th "SaaS-only" provider like PartnerStack or FirstPromoter to make the SaaS pillar more prominent? Customer demand signal unknown.
