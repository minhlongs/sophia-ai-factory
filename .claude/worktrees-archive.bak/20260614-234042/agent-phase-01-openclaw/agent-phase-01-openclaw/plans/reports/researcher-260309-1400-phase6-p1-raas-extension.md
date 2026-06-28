# Research Report: Phase 6 P1 - RaaS Integration Capabilities Extension

**Date:** 2026-03-09 14:00
**Author:** Researcher Agent
**Project:** Sophia AI Factory (RaaS Gateway)
**Work Context:** `/Users/macbookprom1/mekong-cli/apps/sophia-ai-factory`

---

## Executive Summary

This report analyzes 4 priority tasks for extending RaaS Integration Capabilities. Current infrastructure has solid foundations (JWT validation, webhook handlers, usage tracking) but lacks:
1. Multi-tenant attribution in usage events
2. Webhook debugging/visibility tools
3. Feature-level granularity in metering
4. Proactive anomaly detection

**Estimated Total Effort:** 5-7 days for full implementation

---

## Task 1: Multi-Tenant Usage Attribution

### Current State Analysis

#### JWT Claims Structure (`src/lib/security/jwt-validator.ts`)

Current `JwtPayload` interface:
```typescript
export interface JwtPayload {
  sub: string              // user_id
  iat: number              // issued at
  exp: number              // expiration
  permissions?: string[]   // optional permissions
  aud?: string             // audience
  iss?: string             // issuer
}
```

**Gap:** No tenant/organization context in JWT claims. Only individual `user_id`.

#### Cloudflare KV Config (`worker-configuration.d.ts`, `wrangler.toml`)

KV namespaces detected:
- `RAAS_API_KEYS` - API key storage
- `QUOTA_CACHE` - Quota caching
- `CIRCUIT_BREAKERS` - Circuit breaker state

**Gap:** No tenant mapping table for API key → tenant attribution.

#### Usage Events Schema (`src/lib/supabase/types.ts`)

Current `UsageEventRow`:
```typescript
export interface UsageEventRow {
  user_id: string
  license_key_hash: string
  license_nonce: string
  service_name: string
  endpoint: string
  action: string
  credits_used: number
  // ... timing/metadata fields
  external_customer_id: string | null  // ← Already exists!
}
```

**Finding:** `external_customer_id` field EXISTS but is underutilized.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    JWT Token (Enhanced)                         │
│  {                                                              │
│    "sub": "user_123",                                           │
│    "tenant_id": "agency_456",  ← NEW                           │
│    "tenant_role": "admin" | "member" | "viewer", ← NEW          │
│    "permissions": ["api:call", "dashboard:view"]                │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    RaaS Gateway Middleware                       │
│  1. Validate JWT (jwt-validator.ts)                             │
│  2. Extract tenant context                                       │
│  3. Inject into GatewayContext                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Usage Event Emission                           │
│  {                                                               │
│    "user_id": "user_123",                                        │
│    "tenant_id": "agency_456",  ← NEW                            │
│    "tenant_role": "admin",     ← NEW                            │
│    "license_nonce": "abc123...",                                 │
│    "external_customer_id": "polar_cust_789"                      │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

### Code Gaps

| File | Gap | Priority |
|------|-----|----------|
| `jwt-validator.ts` | Add `tenant_id`, `tenant_role` to `JwtPayload` | P0 |
| `raas-gateway-enhanced.ts` | Extract tenant from JWT, pass to usage tracker | P0 |
| `gateway-instrumentation.ts` | Add tenant_id to `GatewayContext` | P0 |
| `types.ts` (UsageEventInput) | Add `tenant_id`, `tenant_role` fields | P0 |
| `wrangler.toml` | Add `TENANT_MAPPING` KV namespace | P1 |

### Implementation Recommendations

#### 1. Extend JWT Payload

```typescript
// src/lib/security/jwt-validator.ts
export interface JwtPayload {
  sub: string
  iat: number
  exp: number
  permissions?: string[]
  aud?: string
  iss?: string
  // NEW: Multi-tenant claims
  tenant_id?: string      // Organization/agency ID
  tenant_role?: string    // 'admin' | 'member' | 'viewer'
  tenant_name?: string    // Human-readable tenant name
}
```

#### 2. Update Usage Event Schema

```typescript
// src/lib/usage-metering/types.ts
export interface UsageEventInput {
  userId: string
  tenantId?: string       // NEW
  tenantRole?: string     // NEW
  licenseKeyHash: string
  licenseNonce: string
  service: AiService
  endpoint: string
  action: string
  creditsUsed: number
  externalCustomerId?: string
  // ... existing fields
}
```

#### 3. Database Migration

```sql
-- Add tenant_id to usage_events
ALTER TABLE usage_events
  ADD COLUMN tenant_id TEXT,
  ADD COLUMN tenant_role TEXT;

-- Create index for tenant-based queries
CREATE INDEX idx_usage_events_tenant_id ON usage_events(tenant_id);
CREATE INDEX idx_usage_events_tenant_timestamp ON usage_events(tenant_id, created_at);
```

**Estimated Effort:** 1-2 days

---

## Task 2: Webhook Replay/Debug UI

### Current State Analysis

#### Webhook Handlers

**Polar Webhook** (`src/lib/payments/polar-webhook-handler.ts`):
- 1000+ lines, handles 10+ event types
- Idempotency via `payment_events` table
- Auto-generates licenses on payment success
- Triggers dunning workflow on failure

**Stripe Webhook** (`src/lib/payments/stripe-webhook-handler.ts`):
- Similar structure to Polar handler
- Separate `payment_events` tracking (stripe_event_id)
- Email notifications via Resend

#### Webhook Logging

Current logging in `processWebhookEvent`:
```typescript
logger.info('Processing webhook event', {
  eventType: event.type,
  webhookId,
  timestamp: new Date().toISOString(),
})
```

**Gap:** Logs are ephemeral. No UI for inspecting historical events.

#### Webhook Routes Structure

```
src/app/api/webhooks/
├── polar/route.ts       # Polar.sh webhook endpoint
├── stripe/route.ts      # Stripe webhook endpoint
├── telegram/route.ts    # Telegram bot webhook
└── overage-billing/     # Overage billing webhook
```

### Proposed UI Design: Webhook Debug Dashboard

#### Page Structure

```
/admin/webhooks
├── Event History Table
├── Event Detail View (modal/slide-over)
├── Manual Replay Interface
└── Signature Verification Test Tool
```

#### Component Architecture

```
src/components/admin/webhooks/
├── webhook-history-table.tsx
├── webhook-event-detail.tsx
├── webhook-replay-button.tsx
├── webhook-signature-tester.tsx
└── webhook-payload-viewer.tsx
```

#### Event History Table Schema

| Column | Type | Description |
|--------|------|-------------|
| ID | UUID | Event primary key |
| Type | string | `checkout.succeeded`, `subscription.created`, etc. |
| Provider | enum | `polar` | `stripe` |
| Status | enum | `pending` | `processing` | `success` | `failed` | `replayed` |
| Customer ID | string | Polar/Stripe customer ID |
| Amount | number | Transaction amount (USD) |
| Created At | timestamp | Event timestamp |
| Processed At | timestamp | When handler completed |
| Error Message | text | If failed |
| Retry Count | number | Number of replay attempts |

### API Design

```typescript
// GET /api/admin/webhooks?provider=polar&status=failed&limit=50
interface WebhookEventList {
  events: WebhookEvent[]
  total: number
  hasMore: boolean
}

// GET /api/admin/webhooks/:id
interface WebhookEventDetail {
  id: string
  provider: 'polar' | 'stripe'
  type: string
  payload: Json
  signature: string
  signatureValid: boolean
  status: 'pending' | 'processing' | 'success' | 'failed'
  errorMessage?: string
  processedAt?: string
  retryCount: number
  replayHistory: Array<{
    replayedAt: string
    replayedBy: string
    result: 'success' | 'failed'
    error?: string
  }>
}

// POST /api/admin/webhooks/:id/replay
interface ReplayRequest {
  eventId: string
}

interface ReplayResponse {
  success: boolean
  error?: string
}
```

### Code Gaps

| File | Gap | Priority |
|------|-----|----------|
| `payment_events` table | Add `replay_count`, `last_replay_at`, `last_replay_by` columns | P0 |
| `src/app/api/admin/webhooks/` | Create CRUD API endpoints | P0 |
| `src/components/admin/webhooks/` | Create UI components | P0 |
| `src/lib/payments/*.ts` | Add structured logging for each event | P1 |

### Implementation Recommendations

#### 1. Database Migration

```sql
-- Add replay tracking to payment_events
ALTER TABLE payment_events
  ADD COLUMN replay_count INTEGER DEFAULT 0,
  ADD COLUMN last_replay_at TIMESTAMPTZ,
  ADD COLUMN last_replay_by TEXT,
  ADD COLUMN replay_history JSONB DEFAULT '[]';

-- Create index for admin queries
CREATE INDEX idx_payment_events_status ON payment_events(processed, created_at DESC);
CREATE INDEX idx_payment_events_type ON payment_events(event_type);
```

#### 2. API Endpoint Example

```typescript
// src/app/api/admin/webhooks/[id]/route.ts
export async function POST(request: Request) {
  const { id } = params
  const { user } = await requireAdminAuth(request)

  const supabase = createAdminClient()

  // Fetch event
  const { data: event } = await supabase
    .from('payment_events')
    .select('*')
    .eq('id', id)
    .single()

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  // Replay event
  try {
    await processWebhookEvent(event.payload, event.polar_event_id)

    // Update replay tracking
    await supabase
      .from('payment_events')
      .update({
        replay_count: event.replay_count + 1,
        last_replay_at: new Date().toISOString(),
        last_replay_by: user.id,
      })
      .eq('id', id)

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
```

**Estimated Effort:** 2-3 days

---

## Task 3: Granular Feature-Level Metering

### Current State Analysis

#### Usage Metering (`src/lib/usage-metering/`)

**Real-Time Tracker** (`realtime-tracker.ts`):
- Tracks credits per license/window
- Circuit breaker pattern for failures
- Redis-backed counters

**Aggregator** (`aggregator.ts`):
```typescript
export interface AggregatedUsage {
  tenantId: string
  licenseNonce: string
  featureKey: string       // ← Already exists! "service_name + action"
  timestamp: number
  consumedUnits: number
  requestCount: number
  tokensInput: number
  tokensOutput: number
}
```

**Gateway Instrumentation** (`gateway-instrumentation.ts`):
```typescript
const service = determineServiceFromPath(pathname) as AiService
const action = determineActionFromPath(pathname) || 'request'
```

Current service determination:
```typescript
function determineServiceFromPath(pathname: string): AiService {
  const match = pathname.match(/^\/api\/([^/]+)/)
  if (match) {
    const serviceName = match[1]
    if (serviceName === 'heygen') return 'heygen'
    if (serviceName === 'elevenlabs') return 'elevenlabs'
    if (serviceName === 'openrouter') return 'openrouter'
    return 'openrouter'  // Default
  }
  return 'openrouter'
}
```

**Gap:** Service/action are generic. No feature tagging for:
- `document_parsing` vs `workflow_automation` vs `api_call`
- Specific feature IDs for ROI tracking

#### ROI Calculator (`src/lib/analytics/roi-calculator.ts`)

Current calculation:
```typescript
const totalCreditsUsed = usageEvents?.reduce((sum, e) => sum + (e.credits_used || 0), 0) || 0
const actualYTD = ytdCredits * valuePerCredit
```

**Gap:** ROI calculated at license level only. No feature-level ROI breakdown.

### Proposed Feature Tagging System

#### Extended Usage Event Schema

```typescript
// src/lib/usage-metering/types.ts
export interface UsageEventInput {
  userId: string
  licenseKeyHash: string
  licenseNonce: string
  service: AiService

  // EXISTING
  endpoint: string
  action: string

  // NEW: Feature-level tagging
  featureType: 'document_parsing' | 'workflow_automation' | 'api_call' | 'video_generation' | 'voice_synthesis'
  featureId: string           // e.g., 'heygen-avatar-create', 'd-id-video-render'
  featureName?: string        // Human-readable name

  // Metadata for advanced tracking
  metadata?: {
    documentPages?: number
    videoDurationSeconds?: number
    voiceMinutes?: number
    apiMethod?: string
    batchSize?: number
    [key: string]: any
  }

  creditsUsed: number
  // ... existing fields
}
```

#### Feature Registry Pattern

```typescript
// src/lib/usage-metering/feature-registry.ts
export interface FeatureDefinition {
  id: string
  name: string
  type: FeatureType
  creditRule: CreditRule
  metadata: {
    category: string
    description: string
    tier?: Tier[]  // Which tiers can access
  }
}

export const FEATURE_REGISTRY: Record<string, FeatureDefinition> = {
  'heygen.createVideo': {
    id: 'heygen.createVideo',
    name: 'HeyGen Video Creation',
    type: 'video_generation',
    creditRule: { type: 'per-call', credits: 10 },
    metadata: {
      category: 'Video',
      description: 'Generate AI avatar video',
    }
  },
  'elevenlabs.synthesize': {
    id: 'elevenlabs.synthesize',
    name: 'ElevenLabs Voice Synthesis',
    type: 'voice_synthesis',
    creditRule: { type: 'per-1k-tokens', creditsPer1k: 5 },
    metadata: {
      category: 'Voice',
      description: 'Text-to-speech synthesis',
    }
  },
  // ... more features
}
```

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    API Request                                   │
│  POST /api/heygen/create-video                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              Gateway Instrumentation                             │
│  1. Extract path: /api/heygen/create-video                      │
│  2. Map to feature: heygen.createVideo                          │
│  3. Lookup in FEATURE_REGISTRY                                  │
│  4. Apply credit rule                                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Usage Event                                   │
│  {                                                               │
│    "service": "heygen",                                          │
│    "featureType": "video_generation",                            │
│    "featureId": "heygen.createVideo",                            │
│    "featureName": "HeyGen Video Creation",                       │
│    "metadata": { "videoDurationSeconds": 30 },                   │
│    "creditsUsed": 10                                             │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│               Feature-Level Aggregation                          │
│  GROUP BY feature_id, DATE_TRUNC('hour', created_at)            │
│  SUM(credits_used), COUNT(*)                                    │
└─────────────────────────────────────────────────────────────────┘
```

### Code Gaps

| File | Gap | Priority |
|------|-----|----------|
| `types.ts` (UsageEventInput) | Add `featureType`, `featureId`, `metadata` | P0 |
| `gateway-instrumentation.ts` | Add feature registry lookup | P0 |
| `tracker.ts` | Store feature fields in DB | P0 |
| `roi-calculator.ts` | Add feature-level ROI breakdown | P1 |
| New: `feature-registry.ts` | Create feature registry | P0 |

### Database Migration

```sql
-- Add feature-level tracking to usage_events
ALTER TABLE usage_events
  ADD COLUMN feature_type TEXT,
  ADD COLUMN feature_id TEXT,
  ADD COLUMN feature_name TEXT,
  ADD COLUMN metadata JSONB DEFAULT '{}';

-- Create indexes for feature analytics
CREATE INDEX idx_usage_events_feature_type ON usage_events(feature_type);
CREATE INDEX idx_usage_events_feature_id ON usage_events(feature_id);
CREATE INDEX idx_usage_events_feature_timestamp ON usage_events(feature_id, created_at);
```

**Estimated Effort:** 1-2 days

---

## Task 4: Anomaly Detection Alerts

### Current State Analysis

#### Alerts (`src/lib/alerts/`)

**Quota Alert Service** (`quota-alert-service.ts`):
- Threshold-based alerts: 80%, 90%, 100%
- Multi-channel: email, SMS
- Rate limiting (1 alert/hour/threshold)
- Template-based messaging

**Gap:** Reactive only. No proactive anomaly detection.

#### Analytics Components (`src/components/analytics/`)

Available components:
- `UsageChart.tsx` - Time series visualization
- `ErrorRateChart.tsx` - Error rate tracking
- `QuotaGauge.tsx` - Quota utilization
- `LicenseMetricsTable.tsx` - License overview
- `ServiceBreakdown.tsx` - Service-level breakdown

**Gap:** No anomaly detection visualizations.

#### Usage Event Tracker (`src/lib/audit/usage-event-tracker.ts`)

Current tracking:
```typescript
export interface ModelInvocationEvent {
  model_name: string
  token_count: number
  tokens_input?: number
  tokens_output?: number
  endpoint: string
  license_nonce: string
  tier: string
}
```

### Proposed Anomaly Detection System

#### Statistical Methods

| Method | Use Case | Threshold |
|--------|----------|-----------|
| **Z-Score** | Usage spikes | `|z| > 3` (3σ from mean) |
| **Moving Average** | Trend deviations | Current > 2x rolling avg |
| **Threshold-Based** | Absolute limits | Fixed ceiling (e.g., 10K credits/hour) |
| **Rate of Change** | Sudden acceleration | Δ > 50% in 1 hour |
| **Frequency Analysis** | License misuse | Multiple IPs in 5 min |

#### Alert Types

```typescript
// src/lib/alerts/anomaly-types.ts
export type AnomalyType =
  | 'usage_spike'           // Z-score > 3
  | 'usage_acceleration'    // d(usage)/dt > threshold
  | 'multi_ip_access'       // >3 IPs in 5 min
  | 'quota_gaming'          // Pattern: 99% usage, reset, repeat
  | 'error_rate_spike'      // Error rate > baseline + 2σ
  | 'revenue_anomaly'       // Expected vs actual revenue gap

export interface AnomalyAlert {
  type: AnomalyType
  severity: 'low' | 'medium' | 'high' | 'critical'
  licenseNonce: string
  userId: string
  detectedAt: number
  metadata: {
    zScore?: number
    baselineValue: number
    currentValue: number
    percentChange: number
    ipAddresses?: string[]
    timeWindow: string
  }
  recommendedAction: string
}
```

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                 Usage Event Stream                               │
│  usage_events table (PostgreSQL)                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              Anomaly Detector (Cron Job)                         │
│  Runs every 5 minutes:                                          │
│  1. Fetch recent usage (last 1 hour)                            │
│  2. Calculate rolling statistics                                │
│  3. Compute Z-scores                                            │
│  4. Detect anomalies                                            │
│  5. Trigger alerts                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Alert Delivery                                 │
│  - Email (Resend)                                               │
│  - SMS (Twilio)                                                 │
│  - Slack webhook                                                │
│  - In-app notification                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│               Admin Dashboard UI                                 │
│  /admin/anomaly-alerts                                          │
│  - Alert history table                                          │
│  - Anomaly visualization                                        │
│  - Investigation tools                                          │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation Code Snippets

#### Z-Score Calculator

```typescript
// src/lib/alerts/zscore-calculator.ts
export function calculateZScore(currentValue: number, historical: number[]): number {
  if (historical.length < 10) return 0  // Not enough data

  const mean = historical.reduce((a, b) => a + b, 0) / historical.length
  const variance = historical.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / historical.length
  const stdDev = Math.sqrt(variance)

  if (stdDev === 0) return 0

  return (currentValue - mean) / stdDev
}

export function isAnomaly(zScore: number, threshold: number = 3): boolean {
  return Math.abs(zScore) > threshold
}
```

#### Moving Average Detector

```typescript
// src/lib/alerts/moving-average-detector.ts
export interface MovingAverageConfig {
  windowHours: number
  thresholdMultiplier: number  // e.g., 2.0 = alert if > 2x average
}

export function detectMovingAverageAnomaly(
  currentValue: number,
  historicalHourly: number[],
  config: MovingAverageConfig
): { isAnomaly: boolean; baseline: number; ratio: number } {
  // Get last N hours
  const window = historicalHourly.slice(-config.windowHours)
  const average = window.reduce((a, b) => a + b, 0) / window.length

  if (average === 0) return { isAnomaly: false, baseline: 0, ratio: 0 }

  const ratio = currentValue / average

  return {
    isAnomaly: ratio > config.thresholdMultiplier,
    baseline: average,
    ratio,
  }
}
```

#### Multi-IP Detector

```typescript
// src/lib/alerts/multi-ip-detector.ts
export async function detectMultiIpAccess(
  licenseNonce: string,
  windowMinutes: number = 5,
  threshold: number = 3
): Promise<{ detected: boolean; ipAddresses: string[] }> {
  const supabase = createAdminClient()
  const windowStart = Math.floor(Date.now() / 1000) - (windowMinutes * 60)

  const { data } = await supabase
    .from('usage_events')
    .select('metadata->>ip_address')
    .eq('license_nonce', licenseNonce)
    .gte('created_at', windowStart)

  if (!data) return { detected: false, ipAddresses: [] }

  const uniqueIps = [...new Set(data.map(e => e.metadata?.ip_address).filter(Boolean))]

  return {
    detected: uniqueIps.length > threshold,
    ipAddresses: uniqueIps,
  }
}
```

### Code Gaps

| File | Gap | Priority |
|------|-----|----------|
| New: `src/lib/alerts/anomaly-detector.ts` | Main anomaly detection logic | P0 |
| New: `src/lib/alerts/zscore-calculator.ts` | Z-score calculations | P0 |
| New: `src/lib/alerts/moving-average-detector.ts` | MA detection | P1 |
| New: `src/lib/alerts/multi-ip-detector.ts` | Multi-IP detection | P1 |
| `src/app/api/admin/anomaly-alerts/` | API for alert history | P0 |
| `src/components/admin/anomaly-alerts/` | UI components | P0 |
| `wrangler.toml` | Add cron trigger for detector | P0 |

### Database Schema

```sql
-- Create anomaly alerts table
CREATE TABLE anomaly_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  license_nonce TEXT NOT NULL,
  user_id TEXT NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}',
  recommended_action TEXT,
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for queries
CREATE INDEX idx_anomaly_alerts_type ON anomaly_alerts(alert_type);
CREATE INDEX idx_anomaly_alerts_license ON anomaly_alerts(license_nonce);
CREATE INDEX idx_anomaly_alerts_detected ON anomaly_alerts(detected_at DESC);
CREATE INDEX idx_anomaly_alerts_unacked ON anomaly_alerts(acknowledged) WHERE acknowledged = FALSE;
```

**Estimated Effort:** 2-3 days

---

## Summary & Prioritization

### Effort Estimates

| Task | Effort | Complexity | Impact |
|------|--------|------------|--------|
| 1. Multi-Tenant Attribution | 1-2 days | Medium | High |
| 2. Webhook Replay/Debug UI | 2-3 days | High | High |
| 3. Feature-Level Metering | 1-2 days | Medium | Medium |
| 4. Anomaly Detection | 2-3 days | High | Medium |
| **Total** | **6-10 days** | | |

### Recommended Implementation Order

1. **Multi-Tenant Attribution (P0)** - Foundation for other features
2. **Feature-Level Metering (P0)** - Enables granular ROI tracking
3. **Webhook Replay UI (P1)** - Operational excellence
4. **Anomaly Detection (P1)** - Proactive monitoring

### Unresolved Questions

1. **Multi-Tenant:** Should tenant be required or optional? What about existing licenses without tenant?
2. **Webhook UI:** Who should have access? Only super-admin or tenant admins too?
3. **Feature Metering:** How to handle backward compatibility with existing usage events?
4. **Anomaly Detection:** What's the alert fatigue threshold? How to tune sensitivity per tenant?

---

**Report Generated:** 2026-03-09 14:00
**Next Steps:** Review with team, prioritize tasks, create implementation plan
