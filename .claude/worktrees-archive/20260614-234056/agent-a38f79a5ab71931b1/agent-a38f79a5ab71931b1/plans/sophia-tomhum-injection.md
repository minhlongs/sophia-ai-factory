# 🦞 Tôm Hùm (OpenClaw) Injection — Sophia AGI Mission

## OBJECTIVE

Tiêm 100% OpenClaw (Tôm Hùm) autonomous gateway framework vào Sophia AI Factory.
Sophia phải trở thành fully autonomous content factory — không cần human intervention.

## CURRENT STATE

- Sophia hiện có: Supabase Auth, Tier Guard, Inngest campaigns, Telegram bot, 10 docs
- Tôm Hùm/OpenClaw: 0 references in codebase — CHƯA TIÊM
- Build status: CHƯA VERIFY

## WHAT IS TÔM HÙM / OPENCLAW?

OpenClaw (Tôm Hùm) là multi-channel autonomous agent gateway từ mekong-cli hub.
Core concepts cần inject vào Sophia:

### 1. Autonomous Campaign Loop (Zero-Manual Factory)

- Campaign creation → script gen → audio gen → video gen → publish → analytics
- ALL steps automated via Inngest functions
- Retry + resumable (Smart Resume pattern)
- Status tracking real-time via Telegram bot

### 2. Multi-Channel Distribution Gateway

- Route content to multiple channels: YouTube, TikTok, Instagram
- Each channel = separate adapter pattern
- Queue-based distribution with rate limiting

### 3. Self-Healing & Monitoring

- Auto-retry failed steps (exponential backoff)
- Health check dashboard (/dashboard/system-health already exists)
- Alert via Telegram when failures occur
- Autonomous recovery without human intervention

## PHASE 1: OpenClaw Gateway Integration

### 1.1 Create Gateway Module

**NEW: `apps/sophia-ai-factory/src/lib/gateway/openclaw-gateway.ts`**

```typescript
/**
 * OpenClaw (Tôm Hùm) Autonomous Gateway
 * Multi-channel content distribution + self-healing
 */
export interface GatewayChannel {
  id: string;
  name: string;
  adapter: ChannelAdapter;
  enabled: boolean;
  rateLimitPerHour: number;
}

export interface ChannelAdapter {
  publish(content: CampaignOutput): Promise<PublishResult>;
  getStatus(): Promise<ChannelStatus>;
  healthCheck(): Promise<boolean>;
}

export class OpenClawGateway {
  private channels: Map<string, GatewayChannel>;
  private retryPolicy: RetryPolicy;

  async distribute(content: CampaignOutput): Promise<DistributionResult>;
  async healthCheckAll(): Promise<HealthReport>;
  async selfHeal(failedChannel: string): Promise<boolean>;
}
```

### 1.2 Create Channel Adapters

**NEW: `src/lib/gateway/adapters/youtube-adapter.ts`**
**NEW: `src/lib/gateway/adapters/tiktok-adapter.ts`**
**NEW: `src/lib/gateway/adapters/telegram-adapter.ts`**

Each adapter implements `ChannelAdapter` interface.

### 1.3 Smart Resume Engine

**NEW: `src/lib/gateway/smart-resume.ts`**

```typescript
/**
 * Smart Resume — resume from last successful step
 * Pattern: checkpoint → retry → resume → complete
 */
export class SmartResumeEngine {
  async checkpoint(campaignId: string, step: string): Promise<void>;
  async getLastCheckpoint(campaignId: string): Promise<Checkpoint | null>;
  async resumeFrom(checkpoint: Checkpoint): Promise<void>;
}
```

### 1.4 Autonomous Loop (Inngest integration)

**MODIFY: `src/lib/inngest/functions/generate-campaign.ts`**

- Add OpenClaw gateway distribution step after video generation
- Add Smart Resume checkpoints at each step
- Add self-healing retry logic
- Add Telegram notification on completion/failure

## PHASE 2: Auto-Discovery Engine Enhancement

### 2.1 Upgrade Affiliate Discovery

**MODIFY: `src/app/[locale]/affiliate-discovery/page.tsx`**

- Add autonomous scanning interval (daily cron via Inngest)
- Add AI-powered affiliate matching (score affiliates by niche relevance)
- Add batch import from discovery results

### 2.2 Create AI Auto-Discovery Inngest Function

**NEW: `src/lib/inngest/functions/auto-discover-affiliates.ts`**

- Daily cron job: scan affiliate networks
- AI scoring: use OpenRouter to evaluate relevance
- Auto-add high-score affiliates to campaign queue
- Telegram notification: "Found X new affiliates for niche Y"

## PHASE 3: Build + Test + Ship

1. `cd apps/sophia-ai-factory && npx next build` — MUST PASS
2. Run existing tests: `npx vitest run` — MUST PASS
3. Verify all new files compile correctly
4. Git commit: `feat(gateway): inject OpenClaw autonomous gateway + smart resume + auto-discovery`
5. Git push to main

## QUALITY GATE

- ✅ `src/lib/gateway/openclaw-gateway.ts` — main gateway class
- ✅ `src/lib/gateway/adapters/` — channel adapters (youtube, tiktok, telegram)
- ✅ `src/lib/gateway/smart-resume.ts` — checkpoint/resume engine
- ✅ `src/lib/inngest/functions/auto-discover-affiliates.ts` — AI auto-discovery
- ✅ Modified `generate-campaign.ts` — gateway integration
- ✅ Build passes
- ✅ Tests pass
- ✅ Committed & pushed

## RULES

- DO NOT break existing functionality
- Use existing Supabase client from `@/lib/supabase/server`
- Use existing Inngest client from `@/lib/inngest/client`
- Use TypeScript strict mode — no `any` types
- Follow existing code patterns in the codebase
- Song ngữ docs nếu tạo docs mới
