# Existing Automation Infrastructure Analysis

## 1. Current Automation Stack
The current stack relies on a **Hybrid Data Model** (Supabase for Product Index, Airtable for User Workflow) and **Event-Driven Webhooks** (n8n, Polar, Telegram).

### Core Workflow (`src/app/actions/automation.ts`)
The automation logic is exposed via Server Actions that trigger n8n workflows:
- **Pattern**: Optimistic UI Update (Airtable) → Async Webhook Trigger (n8n).
- **State Management**: Airtable is the source of truth for workflow state (`draft`, `video_queued`, etc.).
- **Identity**: Currently uses `MOCK_USER_ID`; needs integration with real Auth.

```typescript
// Pattern: Create record -> Fire Webhook -> Return ID
export async function generateScript(formData: FormData) {
  // 1. Create Airtable Record
  const record = await airtable.scripts.create({ ... });

  // 2. Fire-and-forget Webhook
  fetch(process.env.N8N_WEBHOOK_GENERATE_SCRIPT, {
    body: JSON.stringify({ scriptId: record.id, ... })
  });
}
```

### Webhook Handlers
- **Polar (`/api/webhooks/polar`)**: Handles subscription upgrades. Directly updates Supabase `user_profiles`. Secure signature verification implemented.
- **Telegram (`/api/webhooks/telegram`)**: Handles chat commands (`/discover`, `/script`). Currently bypasses Auth (simple command check).

## 2. Phase 2 Auto-Discovery Integration
The discovery engine exists but is disconnected from the campaign workflow.

- **Sophia Index (`src/lib/supabase/sophia-index.ts`)**: Provides `getTop50` and search. Read-only access to `affiliate_products`.
- **Scoring (`src/lib/intelligence/scoring.ts`)**: Pure logic class for calculating SPS scores.
- **Gap**: No "Batch Discovery" trigger. Users currently manually search or view top 50. Campaign mode requires "Find top 5 products for [Niche] -> Generate Scripts".

## 3. Integration Points

### A. Campaign Trigger
**Recommendation**: Create a new Server Action `createCampaign` that orchestrates the flow.
- **Input**: Niche/Topic, Product (optional), Schedule.
- **Storage**: New `Campaigns` table in Airtable (linked to Scripts).
- **Trigger**: Calls new n8n workflow `N8N_WEBHOOK_CAMPAIGN_START`.

### B. Batch Processing
**Recommendation**: Extend `automation.ts` to support batch triggers.
```typescript
// Proposed: Batch Trigger
export async function startCampaign(campaignId: string, products: string[]) {
  // Trigger n8n with array of products to generate scripts for
  await fetch(process.env.N8N_WEBHOOK_BATCH_GENERATE, { ... });
}
```

### C. State Persistence
- **Airtable**: Best for flexible "Campaign CMS" (viewing scripts, statuses, calendar).
- **Supabase**: Keep high-volume product data here. Link via `product_id` in Airtable.

## 4. Gap Analysis

| Component | Current State | Missing / Required |
|-----------|---------------|--------------------|
| **Campaign Entity** | None (only Scripts) | Need `Campaigns` entity (Airtable or Supabase) to group scripts. |
| **Orchestration** | Manual 1-off triggers | Need "Batch Manager" to handle 1 Campaign -> N Scripts flow. |
| **Context** | Users pick Topic manually | Auto-Discovery needs to feed directly into Script Generation. |
| **Feedback Loop** | None | Need status updates from n8n back to App (via Webhook or polling). |

## 5. Recommendations for Implementation

1.  **Define Campaign Schema**: Add `Campaigns` table to Airtable:
    *   `Name`, `Niche`, `Status`, `Schedule`, `LinkedScripts` (1:Many).
2.  **Create Orchestrator Action**: Implement `src/app/actions/campaign.ts`.
    *   Step 1: Fetch top products from `sophiaIndex`.
    *   Step 2: Create Campaign record.
    *   Step 3: Loop create Script records (Draft).
    *   Step 4: Trigger Batch Webhook.
3.  **Upgrade Telegram Bot**:
    *   Map `/campaign [niche]` to this new orchestrator.

## Unresolved Questions
1.  Should "Campaigns" live in Supabase (relation integrity) or Airtable (CMS ease)? *Recommendation: Airtable for MVP velocity.*
2.  How does n8n report back failures for individual items in a batch?
