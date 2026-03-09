---
title: "Phase 4: Feature-Level Metering Integration"
description: "Extend usage events with feature attribution and capture feature context in realtime tracker"
status: pending
priority: P1
effort: 2h
---

# Phase 4: Feature-Level Metering Integration

## Overview

Extend usage tracking to capture feature-level context (`feature_name`, `feature_key`) for granular billing and analytics.

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/usage-metering/types.ts` | Modify | Add feature fields to UsageEventInput |
| `src/lib/usage-metering/realtime-tracker.ts` | Modify | Capture feature context |
| `src/lib/usage-metering/feature-attribution.ts` | Create | Feature attribution helper |
| `src/lib/usage-metering/index.ts` | Modify | Export feature attribution |

## Implementation Steps

### Step 4.1: Update Usage Event Types

```typescript
// File: src/lib/usage-metering/types.ts
// Modify UsageEventInput interface:

export interface UsageEventInput {
  userId: string
  licenseKeyHash: string
  licenseNonce: string
  service: AiService
  endpoint: string
  action: string

  // NEW: Feature-level metering
  featureName?: string    // Human-readable (e.g., "Video Generation")
  featureKey?: string     // Machine-readable (e.g., "heygen.createVideo")

  tokensInput?: number
  tokensOutput?: number
  creditsUsed: number
  requestId?: string
  modelName?: string
  tierAtRequest: string
  statusCode?: number
  errorMessage?: string
  responseTimeMs?: number
  createdAt?: number
  idempotencyKey?: string
  externalCustomerId?: string
  resourceType?: string
}

// Update UsageEventDB interface similarly:
export interface UsageEventDB {
  // ... existing fields ...
  feature_name: string | null
  feature_key: string | null
}
```

### Step 4.2: Create Feature Attribution Helper

```typescript
// File: src/lib/usage-metering/feature-attribution.ts

/**
 * Feature Attribution Service
 *
 * Maps API endpoints and actions to feature keys for billing attribution.
 *
 * @module usage-metering/feature-attribution
 */

import { logger } from '@/lib/utils/logger-utility'

/**
 * Feature definition
 */
export interface FeatureDefinition {
  featureKey: string      // e.g., "heygen.createVideo"
  featureName: string     // e.g., "Video Generation"
  service: string         // e.g., "heygen"
  action: string          // e.g., "createVideo"
  creditMultiplier?: number  // Optional credit multiplier for premium features
}

/**
 * Feature registry - maps endpoint+action to feature definition
 */
const FEATURE_REGISTRY: Record<string, FeatureDefinition> = {
  // HeyGen features
  'heygen:createAvatar': {
    featureKey: 'heygen.createAvatar',
    featureName: 'Avatar Video Generation',
    service: 'heygen',
    action: 'createAvatar',
    creditMultiplier: 2,
  },
  'heygen:createVideo': {
    featureKey: 'heygen.createVideo',
    featureName: 'Standard Video Generation',
    service: 'heygen',
    action: 'createVideo',
  },
  'heygen:translateVideo': {
    featureKey: 'heygen.translateVideo',
    featureName: 'Video Translation',
    service: 'heygen',
    action: 'translateVideo',
    creditMultiplier: 1.5,
  },

  // ElevenLabs features
  'elevenlabs:textToSpeech': {
    featureKey: 'elevenlabs.textToSpeech',
    featureName: 'Text to Speech',
    service: 'elevenlabs',
    action: 'textToSpeech',
  },
  'elevenlabs:speechToSpeech': {
    featureKey: 'elevenlabs.speechToSpeech',
    featureName: 'Speech to Speech',
    service: 'elevenlabs',
    action: 'speechToSpeech',
    creditMultiplier: 1.5,
  },
  'elevenlabs:voiceCloning': {
    featureKey: 'elevenlabs.voiceCloning',
    featureName: 'Voice Cloning',
    service: 'elevenlabs',
    action: 'voiceCloning',
    creditMultiplier: 5,
  },

  // OpenRouter features
  'openrouter:chatCompletion': {
    featureKey: 'openrouter.chatCompletion',
    featureName: 'AI Chat Completion',
    service: 'openrouter',
    action: 'chatCompletion',
  },
  'openrouter:imageGeneration': {
    featureKey: 'openrouter.imageGeneration',
    featureName: 'AI Image Generation',
    service: 'openrouter',
    action: 'imageGeneration',
    creditMultiplier: 3,
  },
}

/**
 * Default feature for unmapped endpoints
 */
const DEFAULT_FEATURE: FeatureDefinition = {
  featureKey: 'unknown.endpoint',
  featureName: 'Unknown Feature',
  service: 'unknown',
  action: 'unknown',
}

/**
 * Get feature definition from request context
 *
 * @param service - Service name (e.g., "heygen")
 * @param endpoint - API endpoint path
 * @param action - Action name
 * @returns Feature definition
 */
export function getFeatureDefinition(
  service: string,
  endpoint: string,
  action: string
): FeatureDefinition {
  // Build registry key
  const key = `${service}:${action}`

  // Look up in registry
  const feature = FEATURE_REGISTRY[key]

  if (!feature) {
    logger.debug('[Feature Attribution] No feature found, using default', {
      service,
      endpoint,
      action,
    })
    return DEFAULT_FEATURE
  }

  return feature
}

/**
 * Extract feature context from request
 *
 * @param request - Request object
 * @returns Feature definition
 */
export function extractFeatureFromRequest(request: Request): FeatureDefinition {
  const url = new URL(request.url)
  const path = url.pathname

  // Extract service from path (e.g., /api/heygen/createVideo -> heygen)
  const pathParts = path.split('/').filter(Boolean)
  const service = pathParts.find(p => p.startsWith('api/'))?.split('/')[1] || 'unknown'

  // Extract action from path or headers
  const action = pathParts[pathParts.length - 1] || 'unknown'

  // Check for explicit feature header
  const featureHeader = request.headers.get('x-feature-key')
  if (featureHeader) {
    const [featureService, featureAction] = featureHeader.split('.')
    return getFeatureDefinition(featureService, path, featureAction)
  }

  return getFeatureDefinition(service, path, action)
}

/**
 * Get all registered features (for admin/dashboard use)
 */
export function getAllFeatures(): FeatureDefinition[] {
  return Object.values(FEATURE_REGISTRY)
}

/**
 * Register new feature dynamically (for plugin systems)
 */
export function registerFeature(feature: FeatureDefinition): void {
  const key = `${feature.service}:${feature.action}`
  FEATURE_REGISTRY[key] = feature

  logger.info('[Feature Attribution] Registered new feature', {
    featureKey: feature.featureKey,
    featureName: feature.featureName,
  })
}
```

### Step 4.3: Update Realtime Tracker

```typescript
// File: src/lib/usage-metering/realtime-tracker.ts
// Modify trackWithCircuitBreaker function:

import { getFeatureDefinition, extractFeatureFromRequest } from './feature-attribution'

export interface TrackUsageParams {
  userId: string
  licenseNonce: string
  tier: string
  creditsUsed: number
  service: string
  endpoint: string
  action: string
  featureName?: string
  featureKey?: string
  tokensInput?: number
  tokensOutput?: number
  windowMs?: number
}

export async function trackUsage(
  params: TrackUsageParams
): Promise<{ allowed: boolean; reason?: string; currentCredits?: number }> {
  // Extract feature if not provided
  const featureName = params.featureName ||
    getFeatureDefinition(params.service, params.endpoint, params.action).featureName
  const featureKey = params.featureKey ||
    getFeatureDefinition(params.service, params.endpoint, params.action).featureKey

  // Apply credit multiplier if feature has one
  const featureDef = getFeatureDefinition(params.service, params.endpoint, params.action)
  const effectiveCredits = params.creditsUsed * (featureDef.creditMultiplier || 1)

  // ... existing circuit breaker logic ...

  // Update counter with feature context
  current = {
    ...current,
    currentCredits: current.currentCredits + effectiveCredits,
    // Store feature context for downstream processing
    lastFeatureKey: featureKey,
    lastFeatureName: featureName,
  }

  // ... rest of existing logic ...
}
```

### Step 4.4: Update Usage Event Ingestion

```typescript
// File: src/lib/usage-metering/aggregator.ts
// Modify ingestUsageEvent function:

export async function ingestUsageEvent(
  event: UsageEventInput
): Promise<IngestionResult> {
  // Auto-populate feature fields if not provided
  const featureDef = getFeatureDefinition(event.service, event.endpoint, event.action)

  const dbEvent: UsageEventDB = {
    user_id: event.userId,
    license_key_hash: event.licenseKeyHash,
    license_nonce: event.licenseNonce,
    service_name: event.service,
    endpoint: event.endpoint,
    action: event.action,
    // Feature attribution
    feature_name: event.featureName || featureDef.featureName,
    feature_key: event.featureKey || featureDef.featureKey,
    // ... rest of fields ...
  }

  // Insert into database
  const { data, error } = await supabase
    .from('usage_events')
    .insert(dbEvent)
    .select('id')
    .single()

  // ... rest of existing logic ...
}
```

## Verification

```bash
# Test feature attribution
npm test -- src/lib/usage-metering/feature-attribution.test.ts

# Test usage event with feature fields
npm test -- src/lib/usage-metering/aggregator.test.ts

# Verify database columns
psql "$(npx supabase db url)" -c "
  SELECT feature_name, feature_key
  FROM usage_events
  LIMIT 5;
"
```

## Success Criteria

- [ ] Feature registry maps endpoints to feature keys
- [ ] Usage events include `feature_name` and `feature_key`
- [ ] Credit multipliers applied for premium features
- [ ] Feature attribution works for all services (HeyGen, ElevenLabs, OpenRouter)

## Unresolved Questions

1. Should feature multipliers be configurable per tenant/license?
2. How do we handle custom features defined by agencies (plugin architecture)?
