# Campaign Automation & Orchestration Patterns

## 1. Orchestration Architecture

### Option A: Event-Driven with Supabase (Recommended for MVP)
Leverage existing Supabase infrastructure using Database Webhooks and Edge Functions.
- **Pros:** No new infrastructure (Redis/Worker nodes), native integration with current DB, lower cost.
- **Cons:** 25s timeout on Edge Functions (hard limit), less robust retry logic compared to dedicated queues.
- **Best for:** Simple workflows, tight budget, rapid MVP.

### Option B: Dedicated Job Queue (Inngest/BullMQ)
Use a specialized background job orchestration platform.
- **Pros:** Long-running jobs (essential for Video AI), complex flow control (step A -> wait -> step B), robust retries, visual dashboard.
- **Cons:** Adds external dependency (Inngest Cloud or Redis for BullMQ).
- **Recommendation:** **Inngest** fits Next.js serverless architecture best as it works via HTTP push, avoiding persistent worker servers.

### Architecture Decision: Inngest (Serverless Queue)
Due to video generation latency (often > 30s), Supabase Edge Functions may timeout. Inngest handles long-running serverless functions natively.

```typescript
// Example Inngest Flow
export const generateCampaign = inngest.createFunction(
  { id: "generate-campaign" },
  { event: "campaign.created" },
  async ({ event, step }) => {
    const script = await step.run("generate-script", () => generateScript(event.data));
    const audio = await step.run("generate-audio", () => generateVoice(script));
    await step.run("notify-user", () => sendTelegram(event.data.userId, "Ready!"));
  }
);
```

## 2. Automation Triggers

### Triggers
1.  **Manual Start**: User clicks "Create Campaign" -> `POST /api/campaigns` -> Pushes event to Inngest.
2.  **Payment Webhook**: Polar `checkout.session.completed` -> updates `user_profiles` -> (Optional) auto-starts generic "Welcome" campaign.
3.  **Schedule**: Inngest Cron for "Daily Trend" campaigns.

### State Management
Use a state machine column in the `campaigns` table.
- `DRAFT` -> `QUEUED` -> `PROCESSING_SCRIPT` -> `PROCESSING_VIDEO` -> `COMPLETED` | `FAILED`

## 3. Progress Notification Patterns

### Telegram Bot (Existing Integration)
Leverage the existing `telegram-client.ts`.
- **Pattern:** Push notifications on state change.
- **Flow:**
    1.  Campaign status updates in DB.
    2.  DB trigger or Inngest step calls `sendTelegramMessage`.
    3.  User receives: "🎬 Script generated! Generating video..."

### Frontend Updates
- **Polling:** Simple `useQuery` with `refetchInterval: 5000` on the dashboard.
- **Realtime:** Supabase Realtime subscription to `campaigns` table for instant UI updates without polling.

## 4. Campaign Entity Design

### Database Schema (Supabase)

```sql
create type campaign_status as enum (
  'draft', 'queued', 'processing_script', 'processing_video', 'completed', 'failed'
);

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  title text not null,
  topic text,
  audience text,

  -- State & Progress
  status campaign_status default 'draft',
  progress integer default 0, -- 0 to 100
  error_message text,

  -- Assets (JSONB for flexibility)
  script_content jsonb, -- { "scenes": [...] }
  video_url text,
  thumbnail_url text,

  -- Meta
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for dashboard queries
create index idx_campaigns_user on campaigns(user_id);
```

## 5. Testing Strategies

### Async Workflow Testing
- **Unit:** Test individual steps (e.g., `generateScript`) with mocked AI responses.
- **Integration:** Use Inngest Dev Server to trigger events locally and assert DB state changes.
- **E2E:** Playwright test that initiates a campaign and polls for "Completed" status (mocking the long-running AI parts via API routes in test mode).

### Webhook Mocking
Use `stripe-cli` or `polar-cli` (if available) or simple `curl` scripts to simulate webhook events during dev.

```bash
# Test Script Example
curl -X POST http://localhost:3000/api/webhooks/polar \
  -H "webhook-signature: test_sig" \
  -d @test/fixtures/subscription_created.json
```

## Unresolved Questions
1.  Does the current hosting plan support Node.js runtime for Inngest, or are we strictly Edge? (Next.js supports both, but middleware is Edge).
2.  Do we store the generated heavy media (video) in Supabase Storage or external bucket (S3/R2)?
