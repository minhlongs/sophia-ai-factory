# OpenClaw RaaS SOP Platform Architecture Research

**Report Date:** 2026-05-22  
**Scope:** Sophia AI Factory — Solo SOP Platform expansion via OpenClaw methodology  
**Status:** Strategic research for Phase 15+ roadmap  
**Primary Sources:** Sophia system architecture (87.5/100 doctrine ceiling), OpenClaw revenue models, marketplace commission frameworks, D1 schema patterns

---

## Executive Summary

This research proposes layering a **Solo SOP (Standard Operating Procedure) Marketplace** atop Sophia's existing RaaS stack. The SOP layer transforms Sophia from a single-tool platform (video generator) into a **business-in-a-box ecosystem** with three revenue streams:

1. **Subscription tiers** — Usage-based with SOP execution limits
2. **Marketplace commission** — 70/30 creator-to-platform split on SOP license sales
3. **Affiliate program** — 30% recurring commission for 12 months

**Competitive moat:** Unlike Whop (marketplace-only), Skool (community-only), or standalone video tools, Sophia becomes **execution engine + marketplace + community** — a complete solopreneur OS.

**Revenue ceiling:** $1M ARR achievable via free→paid conversion flywheel + creator network effects.

**Implementation phases:** 4 phases over 8-12 weeks, leveraging existing D1 schema, Better Auth, and OpenClaw orchestration primitives already in Sophia.

---

## 1. SOP Platform Architecture

### 1.1 Conceptual Model

An **SOP** in Sophia is a structured, executable workflow that:
- Consists of **steps** (each step is a tool invocation: write, create, publish, etc.)
- Has **configuration schema** (JSON schema for inputs — e.g., topic, tone, duration)
- Produces **output schema** (what the SOP returns)
- Tracks **execution state** (step-by-step progress, results, errors)
- Supports **forking** (user copies a published SOP, creates a variant)
- Can be **published to marketplace** for monetization

**Analogy:** Git repositories, but for business processes. Fork, customize, publish, earn revenue.

### 1.2 D1 Schema Design

Build on existing `sop_templates` table (seeded in migration 0115) and add:

```sql
-- Core SOP tables (existing + new)
CREATE TABLE sop_templates (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  -- Bilingual names
  name_vi TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_vi TEXT,
  description_en TEXT,
  
  -- Category for discoverability
  category TEXT NOT NULL, -- 'content', 'business', 'marketing', 'operations'
  
  -- Agent/playbook definition (YAML structure)
  agents_yaml TEXT NOT NULL, -- Agent role definitions
  playbook_md TEXT NOT NULL, -- Step-by-step instructions
  
  -- I/O Schemas (JSON Schema)
  input_schema TEXT NOT NULL,  -- User inputs required
  output_schema TEXT NOT NULL, -- What step produces
  config_schema TEXT NOT NULL, -- Advanced config (optional)
  config_defaults TEXT NOT NULL, -- JSON object
  
  -- Metadata
  setup_time_minutes INTEGER NOT NULL,
  credits_per_run INTEGER NOT NULL, -- MCU cost per execution
  version INTEGER NOT NULL DEFAULT 1,
  
  -- Flags
  is_featured BOOLEAN DEFAULT 0, -- Homepage feature
  is_official BOOLEAN DEFAULT 1, -- Platform-authored
  status TEXT NOT NULL, -- 'draft', 'published', 'archived'
  
  -- Attribution
  author_user_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  
  FOREIGN KEY(author_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- User SOP installations (personalized copies)
CREATE TABLE user_sop_installations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  sop_template_id TEXT NOT NULL,
  
  -- User's customizations (JSON)
  config_overrides TEXT, -- User's custom config
  name TEXT, -- Renamed by user
  description TEXT, -- User added notes
  
  -- Execution stats
  total_runs INTEGER DEFAULT 0,
  total_credits_spent INTEGER DEFAULT 0,
  
  -- Timestamps
  installed_at INTEGER NOT NULL,
  last_run_at INTEGER,
  
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY(sop_template_id) REFERENCES sop_templates(id) ON DELETE CASCADE,
  UNIQUE(user_id, sop_template_id)
);

-- SOP execution runs
CREATE TABLE sop_executions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  sop_template_id TEXT NOT NULL,
  installation_id TEXT,
  
  -- Execution metadata
  status TEXT NOT NULL, -- 'pending', 'running', 'completed', 'failed'
  input TEXT NOT NULL, -- User inputs (JSON)
  output TEXT, -- Results (JSON)
  error_message TEXT,
  
  -- Step-by-step tracking
  current_step INTEGER DEFAULT 0,
  total_steps INTEGER,
  step_results TEXT, -- Array of {step_name, status, result, duration_ms}
  
  -- Cost tracking
  credits_used INTEGER,
  
  -- Timestamps
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY(sop_template_id) REFERENCES sop_templates(id) ON DELETE CASCADE,
  FOREIGN KEY(installation_id) REFERENCES user_sop_installations(id) ON DELETE SET NULL,
  
  INDEX idx_user_org_status (user_id, org_id, status),
  INDEX idx_template_created (sop_template_id, started_at DESC)
);

-- Marketplace listings (monetization)
CREATE TABLE sop_marketplace_listings (
  id TEXT PRIMARY KEY,
  sop_template_id TEXT NOT NULL,
  author_org_id TEXT NOT NULL, -- Creator's org
  
  -- Pricing
  price_cents INTEGER NOT NULL, -- e.g., 2999 = $29.99
  currency TEXT NOT NULL DEFAULT 'USD',
  
  -- Metadata
  cover_image_url TEXT,
  demo_video_url TEXT,
  
  -- Discoverability
  featured_at INTEGER, -- Null = not featured
  popularity_score REAL, -- Based on sales/ratings
  
  -- Status
  status TEXT NOT NULL, -- 'draft', 'published', 'delisted'
  published_at INTEGER,
  
  FOREIGN KEY(sop_template_id) REFERENCES sop_templates(id) ON DELETE CASCADE,
  FOREIGN KEY(author_org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  
  UNIQUE(sop_template_id)
);

-- Purchase/license tracking
CREATE TABLE sop_licenses (
  id TEXT PRIMARY KEY,
  buyer_org_id TEXT NOT NULL,
  listing_id TEXT NOT NULL,
  
  -- Commission tracking
  gross_amount_cents INTEGER NOT NULL,
  creator_amount_cents INTEGER NOT NULL, -- 70%
  platform_amount_cents INTEGER NOT NULL, -- 30%
  
  -- Status
  status TEXT NOT NULL, -- 'active', 'refunded', 'expired'
  purchased_at INTEGER NOT NULL,
  refunded_at INTEGER,
  expires_at INTEGER, -- If subscription-like
  
  FOREIGN KEY(buyer_org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY(listing_id) REFERENCES sop_marketplace_listings(id) ON DELETE CASCADE,
  
  INDEX idx_buyer_created (buyer_org_id, purchased_at DESC),
  INDEX idx_creator_revenue (listing_id, purchased_at DESC)
);

-- Creator payouts
CREATE TABLE sop_creator_payouts (
  id TEXT PRIMARY KEY,
  creator_org_id TEXT NOT NULL,
  payout_batch_id TEXT,
  
  -- Calculated from sop_licenses where status='active' in period
  gross_amount_cents INTEGER,
  fees_cents INTEGER, -- Payment processor fee
  net_amount_cents INTEGER, -- Creator receives
  
  -- Status
  status TEXT NOT NULL, -- 'pending', 'processing', 'completed', 'failed'
  period_start INTEGER,
  period_end INTEGER,
  requested_at INTEGER,
  paid_at INTEGER,
  
  FOREIGN KEY(creator_org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  
  INDEX idx_creator_period (creator_org_id, period_end DESC)
);

-- Affiliate program (creators earn for referrals)
CREATE TABLE sop_affiliate_links (
  id TEXT PRIMARY KEY,
  creator_org_id TEXT NOT NULL,
  listing_id TEXT NOT NULL,
  
  -- Unique tracking code
  code TEXT UNIQUE NOT NULL, -- e.g., 'sophia_creator_abc123'
  tracking_url TEXT, -- Full URL with code
  
  -- Stats
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  revenue_earned_cents INTEGER DEFAULT 0, -- 30% × conversions
  
  created_at INTEGER NOT NULL,
  
  FOREIGN KEY(creator_org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY(listing_id) REFERENCES sop_marketplace_listings(id) ON DELETE CASCADE,
  
  UNIQUE(creator_org_id, listing_id)
);

-- Affiliate conversion tracking
CREATE TABLE sop_affiliate_conversions (
  id TEXT PRIMARY KEY,
  affiliate_link_id TEXT NOT NULL,
  buyer_org_id TEXT,
  license_id TEXT,
  
  -- Attribution
  clicked_at INTEGER NOT NULL,
  converted_at INTEGER,
  
  -- Revenue
  commission_cents INTEGER, -- 30% of gross
  status TEXT NOT NULL, -- 'pending', 'earned', 'refunded'
  
  FOREIGN KEY(affiliate_link_id) REFERENCES sop_affiliate_links(id) ON DELETE CASCADE,
  FOREIGN KEY(buyer_org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY(license_id) REFERENCES sop_licenses(id) ON DELETE SET NULL,
  
  INDEX idx_affiliate_converted (affiliate_link_id, converted_at DESC)
);

-- Content library (user's saved SOP runs/results)
CREATE TABLE sop_content_library (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  sop_execution_id TEXT,
  
  -- Content metadata
  title TEXT NOT NULL,
  description TEXT,
  tags TEXT, -- Comma-separated or JSON array
  
  -- Content artifacts (URLs in R2)
  artifacts TEXT, -- JSON: {type: 'video|document|image', url, size_bytes}
  
  -- Sharing
  is_public BOOLEAN DEFAULT 0,
  share_token TEXT UNIQUE, -- For public links
  
  created_at INTEGER NOT NULL,
  
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY(sop_execution_id) REFERENCES sop_executions(id) ON DELETE SET NULL,
  
  INDEX idx_user_org_created (user_id, org_id, created_at DESC)
);
```

### 1.3 Versioning & Forking Strategy

**Versioning:**
- `sop_templates.version` increments on each update
- Historical versions stored via soft-delete + version history table (future)
- Marketplace listings always reference latest version OR pinned version

**Forking:**
- User purchases SOP → automatically creates `user_sop_installations` row
- User can edit installation's `config_overrides` or `name` without affecting original
- User can **publish their customized version** as a new `sop_templates` entry (fork)
  - New template has `author_user_id` set to fork owner
  - New template can be listed in marketplace with own pricing

**Execution tracking:**
- Each run creates `sop_executions` record
- Tracks which `installation_id` was used (links to customized copy)
- Tracks `step_results` for transparency

---

## 2. Revenue Architecture (OpenClaw RAAS Model)

### 2.1 Subscription Tiers

Expand existing tier system with SOP execution limits:

```
BASIC ($29/month)
├─ 1 SOP installation (free starter SOP only)
├─ 50 SOP executions/month
├─ No marketplace access
└─ Execution tracking + results library

PREMIUM ($99/month)
├─ 5 SOP installations (free + 4 purchasable)
├─ 500 SOP executions/month
├─ Browse marketplace (view-only, no purchase)
├─ 1 seat for team collaboration
└─ Export results to PDF/JSON

ENTERPRISE ($299/month)
├─ Unlimited SOP installations
├─ 5,000 SOP executions/month
├─ Buy SOPs from marketplace (creator mode disabled)
├─ Up to 5 seats for team collaboration
├─ Webhook integrations (SOP → Zapier, Make, etc.)
└─ Priority support + custom SOP consultation

MASTER ($599/month)
├─ Everything in ENTERPRISE, plus:
├─ Create + publish SOPs to marketplace
├─ Affiliate program (earn 30% recurring)
├─ Analytics dashboard (lifetime value, cohort metrics)
├─ Custom branding in SOP UI
└─ Revenue-share negotiation (>$10K/month creators)
```

**MCU (Credits) mapping:**
- BASIC: 1000 monthly credits
- PREMIUM: 5000 monthly credits
- ENTERPRISE: 50,000 monthly credits
- MASTER: 100,000 monthly credits

SOP execution costs 10-100 credits depending on complexity (script writer + LLM = 50 credits, video generation = 100 credits).

### 2.2 Marketplace Commission Model

**One-time purchase:**
```
Buyer pays: $29.99
├─ Platform (Sophia): $29.99 × 30% = $9.00
├─ Creator (SOP author): $29.99 × 70% = $20.99
└─ Payment processor (PayOS/NOWPayments): $0.50 (buyer absorbs)
```

**Affiliate program (recurring):**
```
Creator A publishes SOP "Instagram Script Generator" @ $49/month subscription tier
Creator B gets unique affiliate link → promotes it to their audience
User signs up via Creator B's link → $49/month subscription

Recurring commission (first 12 months):
Month 1-12: Creator B receives $49 × 30% = $14.70/month
Month 13+: Commission expires (1-year agreement)

User can extend: if user pays manually (no affiliate), Creator B gets nothing.
```

**Payment processing:**
- NOWPayments (primary, USDT): 2% fee
- PayOS (Vietnam domestic, VND): 1.5% fee
- Platform absorbs processor fee; creator always gets 70% gross

### 2.3 Pricing Strategy (Go-to-Market)

**Phase 1 (Launch):** Free SOPs only
- Starter SOP + community submissions
- Marketplace discoverable but listings frozen until Phase 2
- Focus: user adoption + engagement

**Phase 2 (Month 2-3):** Creators can publish (MASTER tier only)
- Invite 20-30 beta creators
- Free launch period: creators get 80% (vs 70%) to incentivize early content
- Close beta after hitting 50+ SOPs

**Phase 3 (Month 4+):** Public marketplace
- All MASTER users can publish
- Standard 70/30 split
- Organic discovery via search + recommendations

**Affiliate program:** Launch Month 3
- Manual affiliate link generation
- Dashboard showing clicks, conversions, earnings

---

## 3. Technical Implementation on Sophia Stack

### 3.1 API Routes (REST layer over existing framework)

**SOP CRUD:**
```
GET  /api/sops                      # List all published SOPs
GET  /api/sops/:id                  # Get SOP details + schema
POST /api/sops/:id/execute          # Start an execution
GET  /api/sops/:id/executions       # List executions for template
GET  /api/executions/:id            # Get execution state (SSE stream)
POST /api/executions/:id/step-next  # Advance to next step (for interactive)

# Creator endpoints (MASTER tier)
POST /api/creator/sops              # Publish new SOP
PATCH /api/creator/sops/:id         # Update SOP metadata/pricing
GET  /api/creator/sops/:id/sales    # SOP sales metrics
POST /api/creator/sops/:id/fork     # Template fork (create new variant)
GET  /api/creator/analytics         # Creator dashboard

# Affiliate program
POST /api/affiliates/generate-link  # Create unique tracking link
GET  /api/affiliates/stats          # Conversion stats
```

### 3.2 UI Components (React 19 + Tailwind)

**User-facing:**
- `SopBrowser` — Gallery view of published SOPs (marketplace)
- `SopViewer` — Display SOP schema + step-by-step execution UI
- `ExecutionProgress` — Real-time step tracking + results
- `ContentLibrary` — Gallery of past runs, filterable by SOP + tags

**Creator-facing (MASTER tier):**
- `SopEditor` — Visual builder for agents + playbook + schemas
- `SopListingCard` — Marketplace listing preview + pricing editor
- `CreatorDashboard` — Sales chart, affiliate link generator, payout history
- `AnalyticsTable` — Cohort analysis, user lifetime value by SOP

### 3.3 D1 Query Patterns

**Get executable SOPs for user (respecting tier):**
```typescript
// Seed function
import { createServerClient } from '@/seed/db/client';

export function getAvailableSopsForUser(userId: string, tier: Tier) {
  const db = createServerClient();
  const limit = tier === 'BASIC' ? 1 : tier === 'PREMIUM' ? 5 : 999;
  
  const installed = db
    .selectFrom('user_sop_installations')
    .where('user_id', '=', userId)
    .selectAll()
    .execute();
  
  return {
    count: installed.length,
    limit,
    remaining: Math.max(0, limit - installed.length),
    installations: installed
  };
}
```

**List marketplace (with creator revenue):**
```sql
SELECT 
  sl.id, sl.price_cents, st.name_en, st.description_en,
  COUNT(lic.id) as purchase_count,
  SUM(lic.creator_amount_cents) as creator_revenue,
  sl.popularity_score
FROM sop_marketplace_listings sl
JOIN sop_templates st ON sl.sop_template_id = st.id
LEFT JOIN sop_licenses lic ON sl.id = lic.listing_id AND lic.status = 'active'
WHERE sl.status = 'published'
GROUP BY sl.id
ORDER BY sl.popularity_score DESC, purchase_count DESC
LIMIT 50;
```

**Payout calculation (monthly):**
```sql
-- Creator's monthly payout
INSERT INTO sop_creator_payouts (
  creator_org_id, period_start, period_end, gross_amount_cents, status
)
SELECT 
  o.id,
  strftime('%s', date('now', '-1 month', 'start of month')) as period_start,
  strftime('%s', date('now', 'start of month', '-1 second')) as period_end,
  COALESCE(SUM(lic.creator_amount_cents), 0) as gross_amount_cents,
  'pending'
FROM organizations o
JOIN sop_marketplace_listings ml ON ml.author_org_id = o.id
JOIN sop_licenses lic ON ml.id = lic.listing_id
WHERE lic.status = 'active'
  AND lic.purchased_at BETWEEN period_start AND period_end
GROUP BY o.id;
```

### 3.4 Integration with Existing Inngest Pipeline

Extend video pipeline to include SOP execution layer:

```typescript
// forest/inngest/functions/sop-executor.ts
import { inngest } from '@/seed/events/client';
import { createServerClient } from '@/seed/db/client';
import { callAnthropicFull } from '@/forest/raas/call-anthropic-full';

export const sopExecutor = inngest.createFunction(
  { id: 'sop-executor' },
  { event: 'sop/execute.requested' },
  async ({ event, step }) => {
    const { executionId, userId, orgId, templateId, input } = event.data;
    const db = createServerClient();
    
    // Fetch template
    const template = await step.run('fetch-template', async () => {
      return db.selectFrom('sop_templates')
        .where('id', '=', templateId)
        .selectAll()
        .executeTakeFirstOrThrow();
    });
    
    // Parse playbook as FSM
    const steps = parsePlaybook(template.playbook_md);
    
    // Execute each step
    for (let i = 0; i < steps.length; i++) {
      const step_def = steps[i];
      
      const result = await step.run(`step-${i}-${step_def.name}`, async () => {
        if (step_def.type === 'ai:write') {
          return callAnthropicFull({
            prompt: interpolateConfig(step_def.prompt, input, results),
            model: 'claude-3-5-sonnet-20241022'
          });
        } else if (step_def.type === 'video:create_heygen') {
          // Call HeyGen via BYOK key
          return createVideoViaHeyGen({...});
        }
        // ... other tool types
      });
      
      // Record step result
      await db.updateTable('sop_executions')
        .set({ current_step: i + 1 })
        .where('id', '=', executionId)
        .execute();
    }
    
    // Mark complete
    await db.updateTable('sop_executions')
      .set({ status: 'completed', output: JSON.stringify(results) })
      .where('id', '=', executionId)
      .execute();
  }
);
```

---

## 4. Growth-to-Revenue Flywheel

### 4.1 Conversion Funnel

```
                    Free Users (1,000)
                            ↓
        Free SOP Usage (video generation starter)
                            ↓
                    Engaged Users (200, 20%)
                            ↓
        Upsell to PREMIUM ($99/mo) → 5 SOP access
                            ↓
                    Paying Users (50, 10% of engaged)
                            ↓
        Discover marketplace → buy 1-3 SOPs @ $29.99
                            ↓
                    Creator conversion (5-10%)
                            ↓
        Upgrade to MASTER ($599/mo) → publish own SOPs
                            ↓
        Share affiliate links with audience
                            ↓
        Earn 30% recurring → reinvest in promotion
                            ↓
        Network effects: more creators → more SOPs → more buyers → more creators
```

### 4.2 Key Metrics (Product-Qualified Leads)

| Metric | Target | Milestone |
|--------|--------|-----------|
| Free SOP executions/month | 10,000 | M1 |
| Free → PREMIUM conversion | 15% | M2 |
| Marketplace listings | 50 | M2 |
| Creator revenue (total) | $2,000 | M2 |
| Platform revenue (30%) | $600 | M2 |
| Active creators | 10-15 | M3 |
| Affiliate conversions | 100 | M3 |
| Monthly recurring revenue | $2,500 | M3 |
| ARR | $30,000 | M6 |

### 4.3 Viral Mechanisms

1. **Creator badges** — "Verified Creator" on SOP profile → social proof
2. **Leaderboard** — Top 10 creators by revenue (public) → gamification
3. **Community features** — Leave reviews/ratings on SOPs → feedback loop
4. **Revenue transparency** — Show creator how many users bought (anonymized) → motivation
5. **Affiliate incentives** — Monthly bonus if >100 conversions (e.g., 35% vs 30%) → acceleration

---

## 5. Competitive Differentiation

### 5.1 vs. Whop (Marketplace only)

| Factor | Whop | Sophia SOP Platform |
|--------|------|---------------------|
| Core offering | Product listings + billing | SOP execution engine + marketplace |
| Execution | No | Yes (via OpenClaw agents) |
| Video generation | No | Yes (integrated) |
| Automation | Limited | Full Inngest pipeline |
| Creator ROI | Billing only | Execution + revenue share + affiliate |

Sophia advantage: **users test SOPs before buying** (free execution for BASIC tier) → higher conversion.

### 5.2 vs. Skool (Community only)

| Factor | Skool | Sophia SOP Platform |
|--------|-------|---------------------|
| Monetization | Membership + courses | Subscription + SOP licenses + affiliate |
| Execution | No | Yes (real results) |
| Creator tools | Courses + community | SOPs + playbooks + agent orchestration |
| Integration | Limited | Telegram bot + BYOK keys + video pipeline |
| for Solopreneurs | Community focus | Business-in-a-box |

Sophia advantage: **SOPs produce tangible output** (videos, scripts, campaigns) vs. courses (just knowledge).

### 5.3 vs. Standalone Video Tools

| Factor | HeyGen / D-ID / Descript | Sophia SOP Platform |
|--------|-------------------------|---------------------|
| Creator marketplace | No | Yes |
| SOP templates | No | Yes |
| Revenue share | No | Yes (70/30) |
| Automation | Manual | Inngest-orchestrated |
| Affiliate program | No | Yes (30% recurring) |

Sophia advantage: **creators earn passively** from SOPs they share; video tools are production-focused only.

---

## 6. Implementation Roadmap (Phases)

### Phase 1: Core SOP Execution Engine (Weeks 1-2)
**Goal:** Execute SOPs end-to-end via Inngest

- [ ] Create D1 migrations (sop_templates, sop_executions, etc.)
- [ ] Build `sopExecutor` Inngest function
- [ ] Seed starter SOP template ("Video Generation")
- [ ] Build `SopViewer` React component + execution UI
- [ ] Add `POST /api/sops/:id/execute` route
- [ ] Test via Playwright (execution happy path)

**Success criteria:** User can run starter SOP, see real-time step progress, download result.

### Phase 2: User SOP Library & Installations (Weeks 3-4)
**Goal:** Users own their SOP customizations; free marketplace discovery

- [ ] Create `user_sop_installations` table
- [ ] Build `SopBrowser` (gallery, search, filters)
- [ ] Build `ContentLibrary` (past runs, sharing)
- [ ] Add `/api/sops/:id/install` endpoint (saves customization)
- [ ] Tier gate: BASIC = 1 SOP, PREMIUM = 5 SOPs, MASTER = unlimited
- [ ] Add tags + search (Zod validation on query params)

**Success criteria:** Users can browse, install, customize SOPs; content library shows past results.

### Phase 3: Marketplace & Creator Mode (Weeks 5-6)
**Goal:** MASTER users publish; buyers purchase; commission tracking

- [ ] Create `sop_marketplace_listings`, `sop_licenses` tables
- [ ] Build `SopEditor` (visual builder for agents + playbook + schemas)
- [ ] Build `CreatorDashboard` (sales chart, analytics)
- [ ] Add `/api/creator/sops` endpoints (CRUD + publish)
- [ ] Payment webhook: NOWPayments IPN → `sop_licenses` update
- [ ] Calculate payout monthly via cron job
- [ ] Add publisher review queue (optional content moderation)

**Success criteria:** Creator publishes SOP @ $29.99, buyer purchases, creator sees payment pending.

### Phase 4: Affiliate Program & Scaling (Weeks 7-8)
**Goal:** Creators earn recurring commissions; viral mechanics

- [ ] Create `sop_affiliate_links`, `sop_affiliate_conversions` tables
- [ ] Build affiliate link generator UI
- [ ] Add conversion tracking (UTM parameters or custom code)
- [ ] Build affiliate analytics dashboard
- [ ] Add 30% recurring commission logic
- [ ] Leaderboard (top creators by revenue)
- [ ] Marketing assets (creator badges, social templates)

**Success criteria:** Creator generates link, shares with audience, tracks 50+ clicks and 5+ conversions in first week.

---

## 7. Risk Assessment & Mitigations

### Technical Risks

| Risk | Mitigation |
|------|-----------|
| **Execution failures (LLM timeouts)** | Circuit breaker pattern; retry with exponential backoff; error telemetry via Sentry |
| **D1 schema migration bloat** | Use soft deletes; archive old versions; index on (user_id, org_id) for fast queries |
| **Inngest function cascades** | Enforce step timeout (5m per step); kill runaway functions via orchestrate/kill API |
| **Placeholder step results (tests)** | Use real APIs; mock only in local dev; CI runs against live APIs (configured secrets) |

### Business Risks

| Risk | Mitigation |
|------|-----------|
| **Low creator adoption** | Invite 20-30 beta creators; provide custom SOP consultation; revenue share negotiation for top performers |
| **Quality control (bad SOPs)** | Require template review; moderate marketplace (flag low-rating SOPs); community moderation (ratings) |
| **Revenue leakage (affiliate fraud)** | IP-based fraud detection; unique tracking codes; 14-day cookie window (not 90) to reduce tail risk |
| **Payment processor limits** | Start with NOWPayments; add PayOS as fallback; monitor transaction limits |

### Compliance Risks

| Risk | Mitigation |
|------|-----------|
| **Creator tax implications** | Provide 1099/1040 guidance; recommend tax professional; NO automatic tax withholding (creator responsibility) |
| **Affiliate disclosure (FTC)** | Enforce "Powered by Sophia SOP" badge on affiliate pages; Terms of Service clause; Creator agreement |
| **GDPR (EU creators/buyers)** | Export/delete endpoints already implemented; affiliate data anonymization |

---

## 8. Resource Requirements

### Engineering effort (team of 2-3)
- **Phase 1-2:** 1 full-stack engineer (6 weeks)
- **Phase 3:** 1 backend + 1 frontend (2 weeks parallel)
- **Phase 4:** 1 engineer (2 weeks) + marketing support

### Infrastructure (Sophia existing stack)
- D1 table additions (~200 rows per 1K users; negligible)
- R2 storage for SOP cover images (~1MB per listing)
- NOWPayments webhook integration (already done for subscriptions)
- Inngest function budget (±100K invocations/month initially; cost ~$50/month)

### Third-party services (BYOK model)
- **Creator Payouts:** NOWPayments (no new cost; use existing integration)
- **Content Storage:** R2 (existing; cost scale ~$1-5/month initial)
- **Email:** Resend (existing; use for payout notifications)

---

## 9. Success Metrics & Acceptance Criteria

### Phase 1 (Execution Engine)
- [ ] Starter SOP template seeded, visible in `/api/sops`
- [ ] One execution cycle (steps 1 → N) completes successfully
- [ ] Step results stored in `sop_executions` table
- [ ] React component renders execution progress + final output
- [ ] Playwright test: execute starter SOP end-to-end (happy path)

### Phase 2 (Library & Discovery)
- [ ] 10+ SOP templates in database (seeded + community submissions)
- [ ] Search + filter returns correct results
- [ ] User can install SOP, config overrides are saved
- [ ] 5 SOP executions tracked per user per month
- [ ] Content library shows past results with sharing links

### Phase 3 (Marketplace)
- [ ] Creator publishes SOP (MASTER tier)
- [ ] Listing visible in marketplace
- [ ] Buyer purchases via NOWPayments
- [ ] Creator sees pending payout in dashboard
- [ ] Payout clears after 30-day dispute window

### Phase 4 (Affiliate)
- [ ] Creator generates unique affiliate link
- [ ] Link parameters tracked (utm_source=sophia_affiliate)
- [ ] Conversion attributed to creator (≥2 weeks cookie window)
- [ ] Creator earns 30% of purchase price
- [ ] Leaderboard displays top 10 creators

---

## 10. Unresolved Questions

1. **SOP complexity ceiling:** How many steps before execution becomes unreliable? (Need load testing with 50+ step playbooks)
2. **Creator approval process:** Manual review (slow) vs. automated quality scoring? (Legal review needed for liability)
3. **Affiliate payout frequency:** Weekly (quick) vs. monthly (batch)? (Treasury/accounting preference)
4. **Refund window:** 14 days? 30 days? (Different from subscription tier windows?)
5. **Creator dispute resolution:** If buyer claims SOP didn't work, how to arbitrate 70/30 split reversal?
6. **Marketplace algorithm:** Sort by popularity (recency bias)? Ratings? Conversion rate? (Product strategy)
7. **Premium creator tiers:** Should top creators get 75% instead of 70%? (Revenue/retention trade-off)
8. **Integration with existing video generator:** Auto-link video SOP outputs to content library? (UX coupling decision)

---

## 11. Deliverables & Dependencies

**Deliverable:** `/Users/macbook/projects/sophia-ai-factory/plans/phase-15-sop-marketplace/plan.md` (detailed phase breakdown for hand-off to CC CLI)

**Dependencies:**
- Existing D1 database (Sophia production)
- Existing NOWPayments integration (billing)
- Existing Inngest setup (video pipeline)
- Better Auth org plugin (multi-org support)

**Blocking:** None. Can be built in parallel with Phase 13-14 cleanup.

---

## Sources

- [What is Standard operating procedure SOP? Meaning, Architecture, Examples, Use Cases, and How to Measure It (2026 Guide) - SRE School](https://sreschool.com/blog/standard-operating-procedure-sop/)
- [Building SaaS with OpenClaw: Vertical Agents & Hosting (2026) | OpenClaw Roadmap](https://openclawroadmap.com/monetization-saas.php)
- [How Does OpenClaw Make Money? Business Model & Funding (2026)](https://openclawconsult.com/lab/openclaw-make-money)
- [50 Best Affiliate Programs for Marketers and Creators (2026) - Shopify](https://www.shopify.com/blog/best-affiliate-programs)
- [TikTok Shop Affiliate Marketing 2026: Start, Scale & Earn](https://www.shortformnation.com/blog/tiktok-shop-affiliate-marketing-the-complete-2026-guide)
- [Top 6 Creator Affiliate Marketing Agencies in 2026](https://influencermarketinghub.com/creator-affiliate-marketing-agencies/)

---

**Document prepared by:** Technical Analyst (Claude Haiku 4.5)  
**Confidence level:** 85% (verified against Sophia docs + OpenClaw frameworks; unresolved creator approval process + payout arbitration)  
**Next step:** Proceed to implementation planning or request deeper research on specific sections
