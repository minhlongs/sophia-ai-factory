# Growth Triad V3 Tech Stack Specification

## 1. System Overview

This specifies the 3 Growth Pillars implementing the BYOK (Bring Your Own Key) doctrine on Cloudflare Workers + D1 SQLite, orchestrated via Inngest.

### Core Stack
- **Runtime**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite) with Drizzle ORM
- **Orchestration**: Inngest (Background events, delays, fanouts)
- **Framework**: Hono / Next.js (App Router)
- **Validation**: Zod (Zero `:any` types)
- **Typing**: Strict TypeScript

## 2. The 3 Growth Pillars

### Pillar 1: B2B Multi-Channel Cold Outreach Engine
- **Warmup Curves**: Inngest cron jobs scheduling progressively increasing send volumes, adjusting D1 `tenant_smtp_metrics`.
- **CAN-SPAM HMAC Unsubscribe**: Cryptographically signed `unsubscribe` links verifying tenant ID + receiver email without exposing DB sequences.
- **Booking Integration**: Cal.com webhooks mapped via `inngest.send()` to update prospect state from `cold` to `booked`.
- **BYOK Doctrine**: Tenants provide their own Resend/SMTP keys and Cal.com API tokens stored encrypted at rest. Zero operator credentials used.

### Pillar 2: TikTok Shop Creator Outreach & Sample Fulfillment CRM
- **GMV Radar**: Cron-driven polling (via Inngest) indexing creator GMV velocity into local D1 `creator_radars` table.
- **Sample Gating**: State machine verifying `follower_count > threshold` AND `engagement_rate_30d > min_engagement` before releasing sample approval events.
- **Commission Escalator**: Triggered Inngest function `creator.commission.escalate` firing when affiliated product sales cross threshold X, automating tier upgrades.
- **BYOK Doctrine**: Tenants configure their own TikTok Shop Partner/App secrets.

### Pillar 3: Omnichannel Attribution & Dynamic Tier Splitter
- **Multi-Touch Attribution**: Lightweight pixel/postback collector storing touchpoints (`utm_source`, `gclid`, `fbclid`, timestamps) in D1 `touchpoints` table. Includes first-click/last-click weighting SQL queries.
- **LTV / CAC Calculation**: Daily Inngest aggregation jobs projecting LTV cohort data vs. rolling 30-day ad spend metrics.
- **Auto-Payout Tiers**: D1 Trigger or Inngest workflow calculating affiliate splits dynamically based on `tier_id` and auto-generating Payout instructions (e.g., Stripe Connect transfer events).

## 3. Sophia AI 4-Layer Architecture

All components MUST conform to the `seed -> tree -> forest -> land` structure:

### Layer 1: Seed (Domain & Primitives)
```typescript
// path: src/seed/growth/touchpoint-schema.ts
import { z } from "zod";
export const TouchpointSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  source: z.string().min(1),
  timestamp: z.number()
});
export type Touchpoint = z.infer<typeof TouchpointSchema>;
```
*Contains pure Zod schemas, types, Drizzle table definitions, and core utility functions.*

### Layer 2: Tree (Business Logic & Use Cases)
```typescript
// path: src/tree/growth/eval-creator-sample.ts
import { db } from "@/seed/db";
import { SampleRequest } from "@/seed/growth/sample-schema";
// Enforces rules: only approve if follower_count > 10000
```
*Pure business logic. No HTTP knowledge. Max 200 LOC per file.*

### Layer 3: Forest (Orchestration & Inngest Workflows)
```typescript
// path: src/forest/growth/inngest/warmup-flow.ts
import { inngest } from "@/seed/inngest/client";
import { sendColdEmail } from "@/tree/growth/send-email";
export const warmupFlow = inngest.createFunction(
  { id: "growth-warmup-cron" },
  { cron: "0 9 * * *" }, // Daily at 9AM
  async ({ step }) => { /* ... */ }
);
```
*Coordinates Inngest steps, external API retries, and cross-domain transactions.*

## 4. Strict Constraints
1. **LOC Limit**: No file exceeds 200 lines of code. Split aggressively.
2. **Type Safety**: Strictly `0` instances of `:any` or `:any[]` allowed.
3. **Data Security**: Tenant BYOK (Bring Your Own Key) only. No shared Sophia operator keys for sending emails or fetching TikTok metrics.
4. **Environment**: Ensure Cloudflare D1 limits (no deep joins fetching > 1MB) are respected via cursor pagination.
