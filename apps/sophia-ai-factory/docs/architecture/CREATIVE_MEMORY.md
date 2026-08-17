# Creative Memory Architecture

> **Layer**: tree  
> **Module**: `src/tree/creative-memory/`  
> **Database Table**: `creative_memory`  
> **Status**: Production-ready (Phase 1)

## Purpose

Creative Memory is Sophia's persistent, versioned knowledge store. It captures what the platform learns about a workspace's creative preferences, audience behavior, and performance patterns — across missions, campaigns, and time.

Unlike a cache, Creative Memory:
- **Version increments** on every update (audit trail)
- **Scopes** entries to global / campaign / project / channel
- **Tracks confidence** (high / medium / low) and source (human_edit / agent_inference / performance / import)
- **Stores evidence** as JSON (supporting events, A/B test IDs, human approvals)

## Data Model

```
CreativeMemory
├── id: string (pk)
├── workspace_id: string (indexed)
├── category: MemoryCategory
│   ├── identity      — brand voice, visual style, tone
│   ├── creative      — content formulas, formats that work
│   ├── audience      — persona data, engagement patterns
│   ├── performance   — metrics benchmarks, CVR trends
│   ├── business      — revenue models, pricing experiments
│   ├── operational   — process learnings, tool preferences
│   └── provenance    — approval patterns, edit history
├── key: string (unique per workspace+category+scope)
├── value: JSON (arbitrary domain data)
├── confidence: 'high' | 'medium' | 'low'
├── source: string
├── evidence: string (JSON array)
├── scope: 'global' | 'campaign' | 'project' | 'channel'
├── scope_id: string | null
├── version: number (auto-incremented)
├── is_deleted: boolean (soft delete)
├── expires_at: timestamp | null
├── created_at / updated_at
```

**Unique constraint**: `(workspace_id, category, key, scope, scope_id, is_deleted)` — one active version per key.

## API

| Function | Purpose |
|---|---|
| `upsertMemory(entry)` | Insert new (version=1) or bump existing version |
| `getMemory(workspaceId, category, key)` | Fetch current active version |
| `getMemoryByCategory(workspaceId, category)` | List all active memories in a category |
| `listMemoryKeys(workspaceId, category?)` | List keys without values (lightweight) |
| `deleteMemory(id)` | Soft-delete (sets is_deleted=true) |
| `purgeMemory(id)` | Hard-delete (D1 only — use with caution) |
| `recordLearning(workspaceId, category, key, value, evidence)` | Convenience: upsert with source='performance', confidence='medium' |

## Versioning Strategy

```
v1: { tone: 'professional' }   ← initial (Setup Wizard)
v2: { tone: 'warm' }           ← human edit via dashboard
v3: { tone: 'warm', cta: 'shop now' } ← agent inference from performance
```

Every update creates a new version. Old versions are preserved for:
- Provenance audits ("why did the AI choose this tone?")
- Rollback ("revert to v2")
- Learning analysis ("how did tone evolve over 10 missions?")

## Memory Flywheel

```
PERFORMANCE EVENT
    ↓ recordLearning()
CREATIVE MEMORY (updated)
    ↓ informs next mission
NEXT MISSION (better creative decisions)
    ↓ produces
NEW PERFORMANCE DATA
    ↓ loop continues
```

## Integration Points

- **Land**: Billing actions read `business` memories for pricing context
- **Forest**: Inngest jobs read `audience` memories before content generation
- **Tree**: Mission lifecycle reads `creative` memories when creating goals
- **Seed**: Domain types define the schema

## Migration

**File**: `migrations/0234_creative_memory.sql`  
**Applied**: 2026-08-16 (production D1)