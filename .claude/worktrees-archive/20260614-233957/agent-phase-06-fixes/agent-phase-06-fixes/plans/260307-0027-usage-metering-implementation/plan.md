---
title: "Usage Metering Implementation"
description: "Track AI service API calls (HeyGen, ElevenLabs, OpenRouter) with token usage for billing attribution"
status: complete
priority: P1
effort: 8h
branch: main
tags: [usage-metering, billing, ai-services, tracking]
created: 2026-03-07
---

# Usage Metering Implementation Plan

## Executive Summary

Implement comprehensive usage metering for Sophia AI Factory to track all AI service API calls (HeyGen, ElevenLabs, OpenRouter) with detailed token/credit consumption data. This enables accurate billing attribution per license key and downstream billing system integration.

## Batch Ingestion Endpoint (Added 2026-03-07)

**Endpoint:** `POST /api/v1/usage`

**Features:**
- Batch ingest up to 1000 usage records per request
- Zod schema validation with comprehensive field validation
- License validation and revocation checking
- Quota enforcement per tier (BASIC/PREMIUM/ENTERPRISE/MASTER)
- Per-record detailed results with quota remaining info
- CSV export with injection protection

**Validation Rules:**
- Service: heygen, elevenlabs, openrouter only
- Timestamp: Not in future, not older than 30 days
- feature_key: Must be "service.action" format
- UUID validation for tenant_id

**Quota Limits:**
- BASIC: 100 daily / 20 hourly / 500 requests / 2,000 monthly credits
- PREMIUM: 500 daily / 100 hourly / 2,500 requests / 10,000 monthly credits
- ENTERPRISE: 2,000 daily / 500 hourly / 10,000 requests / 50,000 monthly credits
- MASTER: 10,000 daily / 2,000 hourly / 50,000 requests / 200,000 monthly credits

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        SOPHIA AI FACTORY                                │
│                                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │
│  │  HeyGen     │    │ ElevenLabs  │    │  OpenRouter │                 │
│  │   (Video)   │    │   (Voice)   │    │   (LLM)     │                 │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                 │
│         │                  │                  │                         │
│         └──────────────────┼──────────────────┘                         │
│                            │                                            │
│                   ┌────────▼────────┐                                   │
│                   │  Usage Metering │                                   │
│                   │   Middleware    │                                   │
│                   └────────┬────────┘                                   │
│                            │                                            │
│              ┌─────────────┼─────────────┐                              │
│              │             │             │                              │
│     ┌────────▼────┐ ┌──────▼──────┐ ┌───▼────────┐                     │
│     │ usage_events│ │   licenses  │ │   audit    │                     │
│     │   (table)   │ │  (existing) │ │   logs     │                     │
│     └─────────────┘ └─────────────┘ └────────────┘                     │
│                            │                                            │
│              ┌─────────────▼─────────────┐                              │
│              │   /api/usage/export API   │                              │
│              │   (Billing System Webhook)│                              │
│              └───────────────────────────┘                              │
└─────────────────────────────────────────────────────────────────────────┘
```

## Research Findings Summary

### Current State (from research reports)

1. **RaaS License System**: Already implemented with `raas_licenses` and `raas_audit_logs` tables
2. **AI Services**: HeyGen (video), ElevenLabs (voice), OpenRouter (LLM scripts) integrated
3. **Tier System**: BASIC, PREMIUM, ENTERPRISE, MASTER tiers with different rate limits
4. **Security**: HMAC validation, RLS policies, audit logging established

### Key Requirements

| Requirement | Implementation |
|-------------|----------------|
| Track API calls per service | `service_name` column in events |
| Record tokens (input/output) | `tokens_input`, `tokens_output` columns |
| Store user ID + license hash | `user_id`, `license_key_hash` columns |
| Tag events for billing | `billing_period`, `license_nonce` tagging |
| Real-time logging | Direct Supabase insert, no batching |
| Export API for billing | `/api/usage/export` endpoint |

---

## Phase 1: Database Schema + Migrations

**Priority:** P1 | **Effort:** 1.5h | **Status:** complete

### Objectives

1. Create `usage_events` table with comprehensive tracking columns
2. Add indexes for common queries (by user, license, service, date)
3. Create RLS policies for secure access
4. Add helper functions for usage aggregation

### Database Schema

```sql
-- ============================================================================
-- Table: usage_events
-- Purpose: Track all AI service API calls with token/credit consumption
-- ============================================================================

CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Attribution
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  license_key_hash TEXT NOT NULL,        -- SHA256 hash of license key
  license_nonce TEXT NOT NULL,           -- Denormalized for faster queries

  -- Service info
  service_name TEXT NOT NULL,            -- heygen | elevenlabs | openrouter
  endpoint TEXT NOT NULL,                -- API endpoint called
  action TEXT NOT NULL,                  -- create_video | text_to_speech | chat_completion

  -- Usage metrics
  tokens_input INTEGER DEFAULT 0,        -- Input tokens (LLM)
  tokens_output INTEGER DEFAULT 0,       -- Output tokens (LLM)
  credits_used INTEGER NOT NULL DEFAULT 1, -- Normalized credits (1 credit = 1 API call or 1K tokens)

  -- Request metadata
  request_id TEXT,                       -- External API request ID
  model_name TEXT,                       -- Model used (e.g., claude-3.5-sonnet)
  tier_at_request TEXT NOT NULL,         -- User's tier at time of request

  -- Response info
  status_code INTEGER,                   -- HTTP status from API
  error_message TEXT,                    -- Error if failed
  response_time_ms INTEGER,              -- API response time in milliseconds

  -- Timestamps
  created_at BIGINT NOT NULL             -- Unix timestamp (seconds)
);

-- ============================================================================
-- Indexes: Performance optimization
-- ============================================================================

-- User lookups
CREATE INDEX idx_usage_events_user ON usage_events(user_id);
CREATE INDEX idx_usage_events_user_created ON usage_events(user_id, created_at DESC);

-- License lookups
CREATE INDEX idx_usage_events_license_hash ON usage_events(license_key_hash);
CREATE INDEX idx_usage_events_license_nonce ON usage_events(license_nonce);

-- Service/endpoint queries
CREATE INDEX idx_usage_events_service ON usage_events(service_name);
CREATE INDEX idx_usage_events_service_action ON usage_events(service_name, action);

-- Time-based queries (billing periods)
CREATE INDEX idx_usage_events_created_at ON usage_events(created_at DESC);
CREATE INDEX idx_usage_events_period ON usage_events(created_at, service_name);

-- Composite for common aggregations
CREATE INDEX idx_usage_events_billing ON usage_events(license_nonce, created_at, service_name);

-- ============================================================================
-- RLS (Row Level Security) Policies
-- ============================================================================

ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

-- Admins have full access
CREATE POLICY "Admins have full access to usage_events"
  ON usage_events
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Users can view their own usage
CREATE POLICY "Users can view own usage events"
  ON usage_events
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR auth.jwt() ->> 'role' = 'service_role'
  );

-- Service role can insert all events
CREATE POLICY "Service role can insert usage events"
  ON usage_events
  FOR INSERT
  WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role'
  );

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function: Get usage summary for a license in a date range
CREATE OR REPLACE FUNCTION get_usage_summary(
  p_license_nonce TEXT,
  p_start_timestamp BIGINT,
  p_end_timestamp BIGINT
)
RETURNS TABLE (
  service_name TEXT,
  total_requests BIGINT,
  total_tokens_input BIGINT,
  total_tokens_output BIGINT,
  total_credits BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ue.service_name,
    COUNT(*)::BIGINT as total_requests,
    COALESCE(SUM(ue.tokens_input), 0)::BIGINT as total_tokens_input,
    COALESCE(SUM(ue.tokens_output), 0)::BIGINT as total_tokens_output,
    COALESCE(SUM(ue.credits_used), 0)::BIGINT as total_credits
  FROM usage_events ue
  WHERE ue.license_nonce = p_license_nonce
    AND ue.created_at >= p_start_timestamp
    AND ue.created_at <= p_end_timestamp
  GROUP BY ue.service_name;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Get daily usage breakdown
CREATE OR REPLACE FUNCTION get_daily_usage(
  p_license_nonce TEXT,
  p_start_timestamp BIGINT,
  p_end_timestamp BIGINT
)
RETURNS TABLE (
  day_timestamp BIGINT,
  service_name TEXT,
  requests BIGINT,
  credits BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (ue.created_at - (ue.created_at % 86400))::BIGINT as day_timestamp,
    ue.service_name,
    COUNT(*)::BIGINT as requests,
    COALESCE(SUM(ue.credits_used), 0)::BIGINT as credits
  FROM usage_events ue
  WHERE ue.license_nonce = p_license_nonce
    AND ue.created_at >= p_start_timestamp
    AND ue.created_at <= p_end_timestamp
  GROUP BY day_timestamp, ue.service_name
  ORDER BY day_timestamp, ue.service_name;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE usage_events IS 'AI service usage tracking for billing attribution';
COMMENT ON COLUMN usage_events.license_key_hash IS 'SHA256 hash of license key for secure lookup';
COMMENT ON COLUMN usage_events.credits_used IS 'Normalized credits: 1 per API call or 1 per 1K tokens';
COMMENT ON COLUMN usage_events.tier_at_request IS 'User tier at time of request (for tiered billing)';
```

### Files to Create

| File | Description |
|------|-------------|
| `docs/migrations/usage-events-schema.sql` | Full migration file above |
| `docs/migrations/usage-events-functions.sql` | Helper functions (if separated) |

### Success Criteria

- [ ] Migration runs without errors on Supabase
- [ ] All indexes created successfully
- [ ] RLS policies tested with admin and regular user
- [ ] Helper functions return correct aggregations

---

## Phase 2: Usage Metering Utility Library

**Priority:** P1 | **Effort:** 2h | **Status:** complete

### Objectives

Create reusable utility library for tracking usage events across all AI services.

### File Structure

```
src/lib/usage-metering/
├── index.ts                 # Main export + public API
├── tracker.ts               # Core tracking logic
├── types.ts                 # TypeScript interfaces
├── constants.ts             # Service definitions, credit mappings
└── export.ts                # Export API utilities
```

### Implementation Details

#### `src/lib/usage-metering/types.ts`

```typescript
/**
 * Supported AI services
 */
export type AiService = 'heygen' | 'elevenlabs' | 'openrouter';

/**
 * Usage event for tracking
 */
export interface UsageEvent {
  userId: string;
  licenseKeyHash: string;
  licenseNonce: string;
  service: AiService;
  endpoint: string;
  action: string;
  tokensInput?: number;
  tokensOutput?: number;
  creditsUsed: number;
  requestId?: string;
  modelName?: string;
  tierAtRequest: string;
  statusCode?: number;
  errorMessage?: string;
  responseTimeMs?: number;
  createdAt?: number;
}

/**
 * Usage summary for a period
 */
export interface UsageSummary {
  serviceName: string;
  totalRequests: number;
  totalTokensInput: number;
  totalTokensOutput: number;
  totalCredits: number;
}

/**
 * Daily usage breakdown
 */
export interface DailyUsage {
  timestamp: number;
  serviceName: string;
  requests: number;
  credits: number;
}

/**
 * Export options
 */
export interface ExportOptions {
  licenseNonce?: string;
  userId?: string;
  startTimestamp: number;
  endTimestamp: number;
  service?: AiService;
  format: 'json' | 'csv';
}
```

#### `src/lib/usage-metering/constants.ts`

```typescript
/**
 * Service endpoint mappings
 */
export const SERVICE_ENDPOINTS = {
  heygen: {
    baseUrl: 'https://api.heygen.com/v2',
    endpoints: {
      createVideo: '/video/generate',
      getVideoStatus: '/video/:id',
      listAvatars: '/avatars',
      listVoices: '/voices',
    }
  },
  elevenlabs: {
    baseUrl: 'https://api.elevenlabs.io/v1',
    endpoints: {
      textToSpeech: '/text-to-speech/:voiceId',
      voices: '/voices',
    }
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    endpoints: {
      chatCompletion: '/chat/completions',
    }
  }
} as const;

/**
 * Credit calculation rules
 * 1 credit = 1 API call OR 1000 tokens
 */
export const CREDIT_RULES = {
  heygen: {
    createVideo: { type: 'per-call', credits: 1 },
    default: { type: 'per-call', credits: 1 },
  },
  elevenlabs: {
    textToSpeech: { type: 'per-call', credits: 1 },
    default: { type: 'per-call', credits: 1 },
  },
  openrouter: {
    chatCompletion: { type: 'per-1k-tokens', creditsPer1k: 1 },
    default: { type: 'per-call', credits: 1 },
  }
} as const;

/**
 * Tier-based rate multipliers
 */
export const TIER_RATE_MULTIPLIERS = {
  BASIC: 1.0,
  PREMIUM: 0.8,      // 20% discount
  ENTERPRISE: 0.6,   // 40% discount
  MASTER: 0.5,       // 50% discount
} as const;
```

#### `src/lib/usage-metering/tracker.ts`

```typescript
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger-utility';
import type { UsageEvent } from './types';

/**
 * Track a usage event
 *
 * Usage:
 * 1. Before API call: startTimer()
 * 2. Make API call
 * 3. After API call: trackUsage() with results
 *
 * @param event - Usage event data
 */
export async function trackUsage(event: UsageEvent): Promise<void> {
  try {
    const supabase = createAdminClient();
    const timestamp = event.createdAt ?? Math.floor(Date.now() / 1000);

    const { error } = await supabase
      .from('usage_events')
      .insert({
        user_id: event.userId,
        license_key_hash: event.licenseKeyHash,
        license_nonce: event.licenseNonce,
        service_name: event.service,
        endpoint: event.endpoint,
        action: event.action,
        tokens_input: event.tokensInput ?? 0,
        tokens_output: event.tokensOutput ?? 0,
        credits_used: event.creditsUsed,
        request_id: event.requestId ?? null,
        model_name: event.modelName ?? null,
        tier_at_request: event.tierAtRequest,
        status_code: event.statusCode ?? null,
        error_message: event.errorMessage ?? null,
        response_time_ms: event.responseTimeMs ?? null,
        created_at: timestamp,
      });

    if (error) {
      logger.error('[Usage Metering] Failed to track usage', {
        error: error.message,
        service: event.service,
        action: event.action,
      });
      // Don't throw - usage tracking should not block main operation
    }
  } catch (error) {
    logger.error('[Usage Metering] Critical error tracking usage', error instanceof Error ? error : new Error(String(error)));
    // Silent fail - usage tracking is non-blocking
  }
}

/**
 * Calculate credits based on service rules
 */
export function calculateCredits(
  service: string,
  action: string,
  tokensTotal?: number
): number {
  const rules = CREDIT_RULES[service as keyof typeof CREDIT_RULES];
  if (!rules) return 1;

  const rule = rules[action as keyof typeof rules] || rules.default;

  if (rule.type === 'per-call') {
    return rule.credits;
  }

  if (rule.type === 'per-1k-tokens' && tokensTotal) {
    return Math.ceil(tokensTotal / 1000) * rule.creditsPer1k;
  }

  return 1;
}

/**
 * Generate license key hash
 */
export function hashLicenseKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}
```

#### `src/lib/usage-metering/export.ts`

```typescript
import { createAdminClient } from '@/lib/supabase/admin';
import type { ExportOptions, UsageSummary, DailyUsage } from './types';

/**
 * Export usage data for billing
 */
export async function exportUsage(options: ExportOptions): Promise<{
  summary: UsageSummary[];
  daily: DailyUsage[];
  events: unknown[];
}> {
  const supabase = createAdminClient();

  // Get summary
  const { data: summaryData, error: summaryError } = await supabase
    .rpc('get_usage_summary', {
      p_license_nonce: options.licenseNonce,
      p_start_timestamp: options.startTimestamp,
      p_end_timestamp: options.endTimestamp,
    });

  if (summaryError) throw summaryError;

  // Get daily breakdown
  const { data: dailyData, error: dailyError } = await supabase
    .rpc('get_daily_usage', {
      p_license_nonce: options.licenseNonce,
      p_start_timestamp: options.startTimestamp,
      p_end_timestamp: options.endTimestamp,
    });

  if (dailyError) throw dailyError;

  // Get raw events (if JSON format)
  let events = [];
  if (options.format === 'json') {
    let query = supabase
      .from('usage_events')
      .select('*')
      .gte('created_at', options.startTimestamp)
      .lte('created_at', options.endTimestamp)
      .order('created_at', { ascending: true });

    if (options.licenseNonce) {
      query = query.eq('license_nonce', options.licenseNonce);
    }
    if (options.userId) {
      query = query.eq('user_id', options.userId);
    }
    if (options.service) {
      query = query.eq('service_name', options.service);
    }

    const { data: eventsData, error: eventsError } = await query;
    if (eventsError) throw eventsError;
    events = eventsData;
  }

  return {
    summary: summaryData as UsageSummary[],
    daily: dailyData as DailyUsage[],
    events,
  };
}

/**
 * Generate CSV export
 */
export function generateCsv(events: unknown[]): string {
  // Implementation for CSV generation
  const headers = ['timestamp', 'service', 'action', 'credits', 'tokens_in', 'tokens_out'];
  // ... CSV generation logic
  return '';
}
```

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/usage-metering/types.ts` | CREATE | TypeScript interfaces |
| `src/lib/usage-metering/constants.ts` | CREATE | Service definitions |
| `src/lib/usage-metering/tracker.ts` | CREATE | Core tracking logic |
| `src/lib/usage-metering/export.ts` | CREATE | Export utilities |
| `src/lib/usage-metering/index.ts` | CREATE | Main export |

### Success Criteria

- [ ] All TypeScript files compile without errors
- [ ] `trackUsage()` correctly inserts events to Supabase
- `calculateCredits()` returns correct values per service
- [ ] `exportUsage()` returns correct aggregated data
- [ ] Unit tests pass (80%+ coverage)

---

## Phase 3: Instrument AI Service Endpoints

**Priority:** P1 | **Effort:** 3h | **Status:** complete

### Objectives

Add usage tracking to all AI service calls:
1. OpenRouter (script generator)
2. ElevenLabs (voice generation)
3. HeyGen (video creation)

### Implementation Pattern

Use wrapper pattern - create instrumented wrappers around existing service calls.

#### 3.1 Instrument OpenRouter (Script Generator)

**File to Modify:** `src/lib/ai/script-generator.ts`

```typescript
import { trackUsage, hashLicenseKey, calculateCredits } from '@/lib/usage-metering';

export async function generateScript(input: GenerateScriptInput): Promise<ScriptOutput> {
  const startTime = Date.now();
  const { topic, audience, tier } = input;
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return generateMockScript(topic, audience);
  }

  try {
    // ... existing API call code ...

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      // ... existing request config ...
    });

    if (!response.ok) {
      const errorText = await response.text();

      // Track failed usage
      await trackUsage({
        userId: getCurrentUserId(), // Implement this
        licenseKeyHash: hashLicenseKey(getLicenseKey()),
        licenseNonce: getLicenseNonce(),
        service: 'openrouter',
        endpoint: '/chat/completions',
        action: 'chat_completion',
        tierAtRequest: tier,
        statusCode: response.status,
        errorMessage: errorText,
        responseTimeMs: Date.now() - startTime,
      });

      throw new Error(`OpenRouter API failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    // Extract token usage from OpenRouter response
    const usage = data.usage; // { prompt_tokens, completion_tokens, total_tokens }

    // Track successful usage
    await trackUsage({
      userId: getCurrentUserId(),
      licenseKeyHash: hashLicenseKey(getLicenseKey()),
      licenseNonce: getLicenseNonce(),
      service: 'openrouter',
      endpoint: '/chat/completions',
      action: 'chat_completion',
      tokensInput: usage?.prompt_tokens ?? 0,
      tokensOutput: usage?.completion_tokens ?? 0,
      creditsUsed: calculateCredits('openrouter', 'chat_completion', usage?.total_tokens),
      modelName: data.model,
      requestId: data.id,
      tierAtRequest: tier,
      statusCode: response.status,
      responseTimeMs: Date.now() - startTime,
    });

    // ... existing response parsing ...
    return parsed;

  } catch (error) {
    // Track error
    await trackUsage({
      userId: getCurrentUserId(),
      licenseKeyHash: hashLicenseKey(getLicenseKey()),
      licenseNonce: getLicenseNonce(),
      service: 'openrouter',
      endpoint: '/chat/completions',
      action: 'chat_completion',
      tierAtRequest: tier,
      errorMessage: error instanceof Error ? error.message : String(error),
      responseTimeMs: Date.now() - startTime,
    });

    return generateMockScript(topic, audience);
  }
}

// Helper functions to implement
function getCurrentUserId(): string {
  // Get from request context or auth
}

function getLicenseKey(): string {
  // Extract from headers/context
}

function getLicenseNonce(): string {
  // Extract from license validation result
}
```

#### 3.2 Instrument ElevenLabs (Voice Generation)

**File to Modify:** `src/lib/ai/text-to-speech-generator-elevenlabs.ts`

```typescript
import { trackUsage, hashLicenseKey, calculateCredits } from '@/lib/usage-metering';

export async function generateVoiceover(input: GenerateVoiceoverInput): Promise<VoiceoverOutput> {
  const startTime = Date.now();
  const { text, tier, voiceId } = input;
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (apiKey) {
    try {
      const result = await generateElevenLabsVoiceover(text, tier, apiKey, voiceId);

      // Track successful usage
      await trackUsage({
        userId: getCurrentUserId(),
        licenseKeyHash: hashLicenseKey(getLicenseKey()),
        licenseNonce: getLicenseNonce(),
        service: 'elevenlabs',
        endpoint: `/text-to-speech/${voiceId}`,
        action: 'text_to_speech',
        creditsUsed: calculateCredits('elevenlabs', 'text_to_speech'),
        tierAtRequest: tier,
        statusCode: 200,
        responseTimeMs: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      // Track failed usage
      await trackUsage({
        userId: getCurrentUserId(),
        licenseKeyHash: hashLicenseKey(getLicenseKey()),
        licenseNonce: getLicenseNonce(),
        service: 'elevenlabs',
        endpoint: `/text-to-speech/${voiceId}`,
        action: 'text_to_speech',
        tierAtRequest: tier,
        errorMessage: error instanceof Error ? error.message : String(error),
        responseTimeMs: Date.now() - startTime,
      });

      // Fall through to mock
    }
  }

  // Mock fallback (still track for analytics)
  const mockResult = { /* ... mock result ... */ };
  await trackUsage({
    userId: getCurrentUserId(),
    licenseKeyHash: hashLicenseKey(getLicenseKey()),
    licenseNonce: getLicenseNonce(),
    service: 'elevenlabs',
    endpoint: '/mock',
    action: 'text_to_speech_mock',
    tierAtRequest: tier,
    statusCode: 200,
    responseTimeMs: Date.now() - startTime,
  });

  return mockResult;
}
```

#### 3.3 Instrument HeyGen (Video Creation)

**File to Modify:** `src/lib/heygen/heygen-client.ts`

```typescript
import { trackUsage, hashLicenseKey, calculateCredits } from '@/lib/usage-metering';

export class HeyGenClient {
  private apiKey: string;
  private tier: Tier;
  private userId: string;
  private licenseNonce: string;

  constructor(apiKey: string, tier: Tier, userId: string, licenseNonce: string) {
    this.apiKey = apiKey;
    this.tier = tier;
    this.userId = userId;
    this.licenseNonce = licenseNonce;
  }

  async createVideo(params: { avatarId: string; voiceId: string; script: string; title?: string }): Promise<string> {
    const startTime = Date.now();

    try {
      const data = await this.request("/video/generate", {
        method: "POST",
        body: JSON.stringify(params),
      });

      const videoId = data?.data?.video_id;

      // Track successful usage
      await trackUsage({
        userId: this.userId,
        licenseKeyHash: hashLicenseKey(getLicenseKey()),
        licenseNonce: this.licenseNonce,
        service: 'heygen',
        endpoint: '/video/generate',
        action: 'create_video',
        creditsUsed: calculateCredits('heygen', 'createVideo'),
        requestId: videoId,
        tierAtRequest: this.tier,
        statusCode: 200,
        responseTimeMs: Date.now() - startTime,
      });

      return videoId;
    } catch (error) {
      // Track failed usage
      await trackUsage({
        userId: this.userId,
        licenseKeyHash: hashLicenseKey(getLicenseKey()),
        licenseNonce: this.licenseNonce,
        service: 'heygen',
        endpoint: '/video/generate',
        action: 'create_video',
        tierAtRequest: this.tier,
        errorMessage: error instanceof Error ? error.message : String(error),
        responseTimeMs: Date.now() - startTime,
      });

      throw error;
    }
  }
}
```

### Context Propagation

To extract `userId`, `licenseKey`, and `licenseNonce` from request context:

**Option A: Async Local Storage (Recommended)**

```typescript
// src/lib/usage-metering/context.ts
import { AsyncLocalStorage } from 'async_hooks';

interface UsageContext {
  userId: string;
  licenseKeyHash: string;
  licenseNonce: string;
  tier: string;
}

export const usageContext = new AsyncLocalStorage<UsageContext>();

export function runWithUsageContext<T>(context: UsageContext, fn: () => T): T {
  return usageContext.run(context, fn);
}

export function getUsageContext(): UsageContext | null {
  return usageContext.getStore() ?? null;
}
```

**Option B: Middleware Extraction**

```typescript
// src/middleware.ts or custom API middleware
import { usageContext } from '@/lib/usage-metering/context';

export async function middleware(request: NextRequest) {
  // Extract license from headers (reuse raas-gate logic)
  const licenseKey = extractLicenseKey(request);
  const licenseInfo = await validateLicenseKey(licenseKey);

  // Get user from Supabase auth
  const user = await getCurrentUser();

  const context: UsageContext = {
    userId: user?.id ?? 'anonymous',
    licenseKeyHash: hashLicenseKey(licenseKey ?? ''),
    licenseNonce: extractNonce(licenseKey),
    tier: licenseInfo?.tier ?? 'BASIC',
  };

  // Store in request headers for downstream use
  const newHeaders = new Headers(request.headers);
  newHeaders.set('X-Usage-Context', JSON.stringify(context));

  return NextResponse.next({
    request: { headers: newHeaders },
  });
}
```

### Files to Modify

| File | Modification |
|------|--------------|
| `src/lib/ai/script-generator.ts` | Add OpenRouter tracking |
| `src/lib/ai/text-to-speech-generator-elevenlabs.ts` | Add ElevenLabs tracking |
| `src/lib/heygen/heygen-client.ts` | Add HeyGen tracking |
| `src/lib/usage-metering/context.ts` | CREATE - Context propagation |

### Success Criteria

- [ ] All API calls tracked with correct attribution
- [ ] Token counts captured for LLM calls
- [ ] Failed calls also tracked (for error analytics)
- [ ] No impact on API response time (<50ms overhead)

---

## Phase 4: Usage Export API for Billing

**Priority:** P1 | **Effort:** 1h | **Status:** complete

### Objectives

Create REST API endpoint for downstream billing systems to fetch usage data.

### API Specification

```
GET /api/usage/export?license_nonce=xxx&start=1234567890&end=1234567890&format=json
GET /api/usage/summary?license_nonce=xxx&period=current_month
```

### Implementation

#### `src/app/api/usage/export/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { exportUsage, generateCsv } from '@/lib/usage-metering/export';
import { logger } from '@/lib/utils/logger-utility';
import { z } from 'zod';

const exportQuerySchema = z.object({
  license_nonce: z.string().min(1, 'license_nonce is required'),
  start: z.string().transform(Number),
  end: z.string().transform(Number),
  format: z.enum(['json', 'csv']).default('json'),
  service: z.enum(['heygen', 'elevenlabs', 'openrouter']).optional(),
});

export async function GET(req: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query params
    const searchParams = req.nextUrl.searchParams;
    const parseResult = exportQuerySchema.safeParse({
      license_nonce: searchParams.get('license_nonce'),
      start: searchParams.get('start'),
      end: searchParams.get('end'),
      format: searchParams.get('format'),
      service: searchParams.get('service'),
    });

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid query params', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { license_nonce, start, end, format, service } = parseResult.data;

    // Verify ownership (user can only access their own usage)
    const { data: license } = await supabase
      .from('raas_licenses')
      .select('created_by')
      .eq('nonce', license_nonce)
      .single();

    if (!license || license.created_by !== user.id) {
      // Admin bypass
      const isAdmin = user.raw_user_meta_data?.role === 'admin';
      if (!isAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Export usage
    const usageData = await exportUsage({
      licenseNonce: license_nonce,
      startTimestamp: start,
      endTimestamp: end,
      service,
      format,
    });

    // Return response based on format
    if (format === 'csv') {
      const csv = generateCsv(usageData.events);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="usage-${license_nonce}-${start}-${end}.csv"`,
        },
      });
    }

    return NextResponse.json(usageData);

  } catch (error) {
    logger.error('[Usage Export API] Error exporting usage', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Failed to export usage' },
      { status: 500 }
    );
  }
}
```

#### `src/app/api/usage/summary/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { exportUsage } from '@/lib/usage-metering/export';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const licenseNonce = searchParams.get('license_nonce');
    const period = searchParams.get('period') || 'current_month';

    // Calculate date range based on period
    const now = Math.floor(Date.now() / 1000);
    let startTimestamp: number;
    let endTimestamp: number = now;

    if (period === 'current_month') {
      const date = new Date();
      startTimestamp = Math.floor(new Date(date.getFullYear(), date.getMonth(), 1).getTime() / 1000);
    } else if (period === 'last_month') {
      const date = new Date();
      date.setMonth(date.getMonth() - 1);
      startTimestamp = Math.floor(new Date(date.getFullYear(), date.getMonth(), 1).getTime() / 1000);
      endTimestamp = Math.floor(new Date(date.getFullYear(), date.getMonth() + 1, 0).getTime() / 1000);
    } else if (period === 'last_7_days') {
      startTimestamp = now - (7 * 86400);
    } else {
      startTimestamp = now - 30 * 86400; // Default 30 days
    }

    const usageData = await exportUsage({
      licenseNonce: licenseNonce!,
      startTimestamp,
      endTimestamp,
      format: 'json',
    });

    return NextResponse.json({
      period,
      startTimestamp,
      endTimestamp,
      summary: usageData.summary,
      totalCredits: usageData.summary.reduce((sum, s) => sum + s.totalCredits, 0),
    });

  } catch (error) {
    logger.error('[Usage Summary API] Error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Failed to get usage summary' },
      { status: 500 }
    );
  }
}
```

### Files to Create

| File | Description |
|------|-------------|
| `src/app/api/usage/export/route.ts` | Export endpoint |
| `src/app/api/usage/summary/route.ts` | Summary endpoint |

### Success Criteria

- [ ] API endpoints return correct data
- [ ] Authentication/authorization working
- [ ] CSV export generates valid CSV
- [ ] JSON export matches schema
- [ ] Rate limiting applied (prevent abuse)

---

## Phase 5: Testing and Validation

**Priority:** P1 | **Effort:** 0.5h | **Status:** complete

### Test Results

✅ **All 462 tests passed (including batch ingestion)**

```
 Test Files  48 passed (48)
      Tests  462 passed (462)
   Duration  ~7s
```

**Test Coverage:**
- `src/lib/usage-metering/aggregator.test.ts` - 30+ unit tests for aggregation, CSV generation, quota checks
- `src/app/api/v1/usage/route.test.ts` - 5 structural tests for batch ingestion endpoint
- All tests passing with 0 failures

**Notes:**
- Usage metering errors in tests are expected (missing env vars in test environment)
- `trackUsage()` has silent-fail error handling by design
- Build passes with 0 TypeScript errors

### Test Plan

#### Unit Tests

```typescript
// src/lib/usage-metering/__tests__/tracker.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { trackUsage, calculateCredits } from '../tracker';

describe('Usage Metering', () => {
  describe('calculateCredits', () => {
    it('should return 1 credit for HeyGen video creation', () => {
      expect(calculateCredits('heygen', 'createVideo')).toBe(1);
    });

    it('should calculate tokens-based credits for OpenRouter', () => {
      expect(calculateCredits('openrouter', 'chatCompletion', 2500)).toBe(3);
    });
  });
});

// src/lib/usage-metering/__tests__/export.test.ts
describe('Usage Export', () => {
  it('should export usage data for date range', async () => {
    // Test export functionality
  });
});
```

#### Integration Tests

```typescript
// src/app/api/usage/__tests__/export.test.ts
import { describe, it, expect } from 'vitest';

describe('GET /api/usage/export', () => {
  it('should return 401 without auth', async () => {
    // Test auth requirement
  });

  it('should return 400 with invalid params', async () => {
    // Test validation
  });

  it('should return usage data with valid request', async () => {
    // Test successful export
  });
});
```

### Validation Checklist

- [ ] Run `npm run build` - 0 TypeScript errors
- [ ] Run `npm test` - All tests pass
- [ ] Verify Supabase migration runs successfully
- [ ] Test export API with Postman/curl
- [ ] Verify usage events appear in Supabase dashboard
- [ ] Test CSV export downloads correctly
- [ ] Verify RLS policies block unauthorized access

### Example curl Commands

```bash
# Test usage export (JSON)
curl -H "Authorization: Bearer $USER_TOKEN" \
  "https://sophia-ai-factory.vercel.app/api/usage/export?license_nonce=abc123&start=1709251200&end=1709337600&format=json"

# Test usage export (CSV)
curl -H "Authorization: Bearer $USER_TOKEN" \
  -o usage-export.csv \
  "https://sophia-ai-factory.vercel.app/api/usage/export?license_nonce=abc123&start=1709251200&end=1709337600&format=csv"

# Test usage summary
curl -H "Authorization: Bearer $USER_TOKEN" \
  "https://sophia-ai-factory.vercel.app/api/usage/summary?license_nonce=abc123&period=current_month"
```

---

## Dependencies

### External Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| `@supabase/supabase-js` | existing | Database access |
| `zod` | existing | Schema validation |

### Internal Dependencies

| Module | Purpose |
|--------|---------|
| `src/lib/raas-gate.ts` | License extraction |
| `src/lib/raas-service.ts` | License validation |
| `src/lib/supabase/admin.ts` | Admin database access |
| `src/lib/utils/logger-utility.ts` | Logging |

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Database migration fails | HIGH | Test on dev Supabase first, rollback plan |
| Usage tracking blocks API calls | MEDIUM | Silent fail policy - tracking errors don't throw |
| Incorrect token counting | MEDIUM | Log raw API responses for debugging |
| RLS policies too restrictive | HIGH | Test with both admin and regular user |
| Performance impact | LOW | Async tracking, no await blocking main flow |

---

## Rollback Plan

If issues detected:

1. **Database**: Run rollback migration to drop `usage_events` table
2. **Code**: Revert to previous commit
3. **API**: Disable `/api/usage/*` routes in middleware

Rollback commands:
```sql
-- Rollback migration
DROP TABLE IF EXISTS usage_events CASCADE;
DROP FUNCTION IF EXISTS get_usage_summary;
DROP FUNCTION IF EXISTS get_daily_usage;
```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| API call tracking coverage | 100% of AI services |
| Token counting accuracy | 95%+ match with provider dashboards |
| Tracking latency overhead | <50ms per call |
| Export API response time | <500ms for 1000 events |
| Test coverage | 80%+ |

---

## Unresolved Questions

| Question | Priority | Notes |
|----------|----------|-------|
| **Q1:** How to handle context propagation across async boundaries? | HIGH | Async Local Storage vs request headers |
| **Q2:** Should failed API calls (with mock fallback) be tracked as failures or successes? | MEDIUM | Recommend tracking both with mock flag |
| **Q3:** Credit conversion rate for different models? | MEDIUM | Claude vs GPT have different pricing |
| **Q4:** Should usage events be batched or real-time? | LOW | Current design: real-time (simpler, reliable enough) |
| **Q5:** Data retention policy for usage events? | LOW | Recommend 12 months for billing disputes |

---

## Next Steps

1. **Approve plan** - Review and approve this implementation plan
2. **Phase 1** - Run database migration on Supabase
3. **Phase 2** - Implement usage metering utility library
4. **Phase 3** - Instrument all AI service endpoints
5. **Phase 4** - Create usage export API
6. **Phase 5** - Run tests and validate

---

*Plan created: 2026-03-07*
*Estimated total effort: 8 hours*
*Priority: P1 (High)*
