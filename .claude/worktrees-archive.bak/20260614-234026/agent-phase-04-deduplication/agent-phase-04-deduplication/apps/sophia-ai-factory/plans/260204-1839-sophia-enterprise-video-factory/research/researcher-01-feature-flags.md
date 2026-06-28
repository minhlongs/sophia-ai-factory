# Feature Flag & Tiered Access Research Report

**Date**: 2026-02-04
**Context**: Next.js 16 (RSC) + React 19
**Focus**: Tier-based feature unlocking (BASIC / PREMIUM / ENTERPRISE)

## 1. Core Distinction: Entitlements vs. Feature Flags

Research indicates a critical architectural distinction often missed:
*   **Entitlements (Tiers)**: Long-lived, strict access control based on billing plan (e.g., "Can access 4K export"). Static to the plan.
*   **Feature Flags**: Short-lived, operational toggles (e.g., "Enable new dashboard UI"). Dynamic.

**Recommendation**: specific "Tier" checks should be handled by an **Entitlement Service**, while "Feature Flags" handle rollout. A hybrid approach allows flags to *override* entitlements for testing.

## 2. Top Libraries for Next.js 16 / React 19

| Library | Type | TypeScript | Next.js 16/RSC Support | Verdict |
| :--- | :--- | :--- | :--- | :--- |
| **PostHog** | SaaS/Self-host | Excellent | Yes (via Server SDK) | **Best All-in-One** (Flags + Analytics) |
| **GrowthBook** | Open Source | Excellent | Yes | Best for high-perf/complexity |
| **LaunchDarkly** | SaaS (Enterprise) | Excellent | Yes | Overkill for bootstrap |
| **Vercel Edge Config** | Infrastructure | Good | Native | Fast, but limited logic |
| **Local Config** | Code-based | Perfect | Native | **Start Here (YAGNI)** |

**Recommendation for Sophia AI**: Start with **Local Config + DB Entitlements** (YAGNI). Migrate to PostHog if complex rollouts or A/B testing becomes necessary.

## 3. Implementation Patterns

### A. Tier-Based Configuration (The "Entitlement" Layer)

Define static capabilities per tier in code. This is faster and type-safe.

```typescript
// config/tiers.ts
export type Tier = 'BASIC' | 'PREMIUM' | 'ENTERPRISE';

export const TIER_CONFIG = {
  BASIC: {
    maxVideoResolution: '1080p',
    aiGenerationLimit: 10,
    canRemoveWatermark: false,
  },
  PREMIUM: {
    maxVideoResolution: '4k',
    aiGenerationLimit: 100,
    canRemoveWatermark: true,
  },
  ENTERPRISE: {
    maxVideoResolution: '8k',
    aiGenerationLimit: Infinity,
    canRemoveWatermark: true,
  },
} as const;

export const getTierLimit = (tier: Tier, feature: keyof typeof TIER_CONFIG['BASIC']) => {
  return TIER_CONFIG[tier][feature];
}
```

### B. Server-Side Gating (RSC) - Preferred

Next.js 16 allows direct async checks in Layouts/Pages.

```typescript
// lib/features.ts
import { currentUser } from '@clerk/nextjs/server'; // or auth solution
import { TIER_CONFIG } from '@/config/tiers';

export async function checkAccess(feature: string) {
  const user = await currentUser();
  const userTier = user?.publicMetadata?.tier as Tier || 'BASIC';

  // 1. Check Entitlement
  const config = TIER_CONFIG[userTier];
  if (!config[feature]) return false;

  // 2. (Optional) Check Feature Flag override
  // const flag = await getFeatureFlag(`override-${feature}`);
  // if (flag !== undefined) return flag;

  return true;
}

// usage in page.tsx
export default async function VideoEditor() {
  if (!await checkAccess('canRemoveWatermark')) {
    return <UpgradeBanner />;
  }
  return <Editor />;
}
```

## 4. Client-Side vs. Server-Side

| Context | Strategy | Why? |
| :--- | :--- | :--- |
| **Page/Layout Routes** | **Server-Side (RSC)** | Security. Prevent code for restricted features from even being sent to the client. |
| **UI Elements (Buttons)** | **Client-Side (Provider)** | Responsiveness. Hide/disable UI elements without page reload. |
| **API Routes** | **Server-Side** | **CRITICAL**. The final gatekeeper. Never trust client checks. |

## 5. Naming Convention Best Practices

Adopt a strictly typed naming schema to prevent "flag soup".

*   **Format**: `[domain]_[feature]_[action]`
*   **Case**: snake_case or camelCase (consistency is key)

**Examples:**
*   `billing_checkout_enabled` (Operational)
*   `editor_ai_generation_v2` (Release)
*   `perm_tier_enterprise_features` (Entitlement - though prefer avoiding flags for this)

## 6. Summary Strategy

1.  **Phase 1 (Bootstrap)**: Use `config/tiers.ts` constants and helper functions. Store user tier in DB/Auth metadata.
2.  **Phase 2 (Growth)**: Add **PostHog** for feature flags to enable A/B testing or gradual rollouts of *new* features.
3.  **Phase 3 (Scale)**: Move Tier Config to database or specialized Entitlement SaaS (e.g., Lago, Stripe Entitlements) if billing logic gets complex.

## Unresolved Questions
1.  Which auth provider is being used? (Affects where we store the "current tier" state).
2.  Do we need dynamic tier configuration (changing limits without code deploy)?

## Sources
*   [PostHog Next.js Docs](https://posthog.com/docs/libraries/next-js)
*   [Vercel Feature Flags Pattern](https://vercel.com/templates/next.js/feature-flags-config-cat)
*   [GrowthBook Architecture](https://docs.growthbook.io/architecture)
