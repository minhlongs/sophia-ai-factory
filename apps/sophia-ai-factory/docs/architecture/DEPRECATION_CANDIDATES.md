# Deprecation Candidates — Sophia 2027 Cleanup

> **Status**: Tracking document  
> **Policy**: Never delete working functionality. Deprecate → migrate → remove after 2 sprint buffer.

## Why Track Deprecations

The Sophia 2027 transformation introduces new abstractions that subsume old code. This document tracks:
- What's being replaced
- What depends on it
- Migration path
- Removal timeline

## Candidates

### 1. Old Mission Types → CreativeMissionStatus

| Old | New | Deprecation Date | Removal Date |
|---|---|---|---|
| `MissionStatus` (in `seed/types/raas.ts`) | `CreativeMissionStatus` (in `seed/types/creative-domain.ts`) | 2026-08-16 | 2026-09-16 |

**Impact**: Mekong's `raas.ts` still uses `MissionStatus` for its own missions. These are DIFFERENT concepts. No migration needed — they coexist with different semantic meanings.

**Action**: Document distinction in code comments. No removal.

### 2. Old `missions` table → `creative_missions`

| Old | New | Deprecation Date | Removal Date |
|---|---|---|---|
| `missions` (Mekong command table) | `creative_missions` (Sophia creative missions) | 2026-08-16 | Never (Mekong owns this) |

**Impact**: Table name collision resolved by renaming Sophia's table. Mekong continues using `missions`.

**Action**: None — they're separate tables now.

### 3. `src/lib/` compatibility layer

| Old | New | Deprecation Date | Removal Date |
|---|---|---|---|
| `src/lib/auth`, `src/lib/subscription`, `src/lib/unified-tier-config`, `src/lib/tier-gate` | `src/seed/auth/`, `src/seed/config/tiers/` | 2026-04-14 | TBD |

**Impact**: Banned imports already enforced by ESLint. Files exist for backward compatibility.

**Action**: Remove after all callers migrated (track via ESLint violation count).

### 4. Generic `Asset` type → ContentAsset + DerivativeAsset

| Old | New | Deprecation Date | Removal Date |
|---|---|---|---|
| Generic `Asset` (if exists) | `ContentAsset`, `DerivativeAsset`, `DistributionAsset` | 2026-08-16 | 2026-10-16 |

**Impact**: New types are more specific. Generic Asset may still be used in legacy code.

**Action**: Audit all `Asset` references. Migrate to specific types. Remove generic after 2 sprints.

## Deprecation Registry (Phase 4 — 2026-08-16)

All deprecation candidates are now tracked in a single source of truth:

**`src/seed/types/deprecation-markers.ts`** — `DEPRECATION_REGISTRY` array with
`target`, `replacement`, `deprecatedAt`, `removableAfter`, `reason`, `kind`,
and `callers` per entry. Helpers: `getDeprecation()`, `listByKind()`,
`getRemovalReady()`.

| # | Target | Replacement | Kind | Removable After |
|---|--------|-------------|------|-----------------|
| 1 | `@/forest/workflows/compute-next` | `@/land/workflows/compute-next` | duplicate | 2026-09-16 |
| 2 | `@/forest/workflows/supervisor-steps` | `@/land/workflows/supervisor-steps` | duplicate | 2026-09-16 |
| 3 | `@/forest/workflows/checkpoint` | `@/seed/missions/checkpoint` | duplicate | 2026-09-16 |
| 4 | `@/tree/agent-fleet/spawn-agent-fleet` | `@/tree/agent-protocol/agent-executor` | superseded | 2026-09-16 |
| 5 | `@/forest/agent-protocol` | `@/tree/agent-protocol` | duplicate | 2026-09-16 |
| 6 | `@/land/openclaw/memory-adapter` | `@/tree/creative-memory` | legacy | 2026-10-16 |
| 7 | `@/src/lib/*` | `@/seed/*`, `@/tree/*` | legacy | TBD |
| 8 | `tree/ai-providers` | none — rebuild fresh on `seed/ai` Provider contract if persisted tenant config is ever needed | legacy | 2026-09-06 |

Every target above carries a `@deprecated` JSDoc tag with its migration path.
No deletions have been made — the policy is **deprecate → migrate → remove
after a 2-sprint buffer**.

## Deprecation Process

1. **Mark**: Add `@deprecated` JSDoc comment with replacement (also register in `DEPRECATION_REGISTRY`)
2. **ESLint**: Add deprecation warning rule (warn-only for 2 sprints, then error)
3. **Migrate**: Update all internal callers
4. **Buffer**: Wait 2 sprints for external consumers to adapt
5. **Remove**: Delete + update docs

## What Must NOT Be Deprecated

- **Setup Wizard** — Protected flow (handover rules)
- **Telegram Bot** — Protected flow (handover rules)  
- **Payment Flow (NOWPayments)** — Protected flow (handover rules)
- **Circuit Breaker** — Core security primitive
- **Result<T,E> pattern** — Core error handling pattern
- **4-layer architecture** — Foundational structure

## See Also

- `REPO_RECONNAISSANCE_2026-08-17.md` — Technical debt inventory
- `sophia-layer-architecture.md` — Layer rules
- `CLAUDE.md` — Banned imports list