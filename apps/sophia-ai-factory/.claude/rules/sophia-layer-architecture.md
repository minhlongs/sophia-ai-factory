# Sophia 4-Layer Architecture

> Code organization convention. Authoritative for `apps/sophia-ai-factory/src/`.

## Layers

| Layer | Files (~) | Vai trò | Examples |
|---|---:|---|---|
| **seed** | 147 | Foundational primitives — types, config, db client, auth base, security utils, logger | `seed/auth/better-auth-session.ts`, `seed/config/tiers/`, `seed/db/client.ts`, `seed/types/`, `seed/utils/logger-utility.ts` |
| **tree** | 162 | Domain-specific reusable — bot logic, BYOK store, handover, audit, telegram | `tree/byok/`, `tree/handover/`, `tree/telegram/`, `tree/audit/`, `tree/credentials/` |
| **forest** | 362 | Reusable infrastructure orchestrators — Inngest jobs, RAAS gateway, usage metering, quota | `forest/inngest/`, `forest/raas/`, `forest/usage-metering/`, `forest/quota/`, `forest/components/` |
| **land** | 113 | Business domain workflows — billing, payouts, affiliates, promo, refunds | `land/billing/`, `land/payouts/`, `land/affiliates/`, `land/promo/`, `land/refunds/` |

## Import direction rules

```
seed   → can be imported by ANY layer (foundational)
tree   → can import: seed
forest → can import: seed, tree (+ may CALL land for orchestration — see cross-layer-orchestration.md)
land   → can import: seed, tree, forest
```

**Forbidden:** seed → tree/forest/land. tree → forest/land. land → forest (would be circular for orchestration paths).

## Canonical import paths

Per `apps/sophia-ai-factory/CLAUDE.md`:

| Concern | Import |
|---|---|
| Auth session | `import { getCurrentUser } from '@/seed/auth/better-auth-session'` |
| Tier lookup | `import { getUserTier } from '@/seed/db/get-user-tier'` |
| DB client (sync) | `import { createServerClient } from '@/seed/db/client'` (NO await) |
| Tier config | `import { TIER_CONFIGS, TIER_CONFIG } from '@/seed/config/tiers'` |

**Banned imports:** `@/lib/auth`, `@/lib/subscription`, `@/lib/unified-tier-config`, `@/lib/tier-gate`.

## Public API per domain (barrel exports)

Top-level domain folders SHOULD export public API via `index.ts`:
- `land/billing/index.ts`, `land/payouts/index.ts`, `land/affiliates/index.ts`
- `forest/inngest/index.ts`, `forest/raas/index.ts`, `forest/usage-metering/index.ts`
- Internal modules (`__tests__/`, `_*.ts`, helpers) NOT re-exported

## Why 4-layer

- **seed** = "What never changes" (types, config, primitives)
- **tree** = "What our domain owns reusably" (BYOK, handover, audit)
- **forest** = "What orchestrates" (jobs, gateways, metering)
- **land** = "What customers pay for" (billing, payouts, affiliates)

Naming via geography (seed → land = depth-of-meaning gradient).

## Seealso

- `cross-layer-orchestration.md` — Forest→Land orchestration exception
- `binh-phap-quality.md` — Quality gates per layer
- `~/projects/sophia-ai-factory/apps/sophia-ai-factory/CLAUDE.md` — Project rules

## Unresolved

- `src/lib/*` vẫn tồn tại như vùng compatibility/shared logic lịch sử. Core primitives mới phải import từ `@/seed/*`; không thêm alias `@/lib/*` mới cho auth/db/tier.
- Barrel exports chỉ ở 3 forest domains; land vừa thêm 3 mới (260504-1813) — verify build OK
