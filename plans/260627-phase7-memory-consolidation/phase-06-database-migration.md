# Phase 06: Database Migration
**Status:** completed — migration applied (0128 + 20260522, schema differs from plan)

**Layer:** seed (database primitive)
**Dependencies:** None
**Files to create:**
- `migrations/0188_creator_memory.sql`

---

## Requirements

Create `creator_memory` table with columns for relevance scoring, access tracking, and TTL-based expiration. Add indexes for tenant-scoped queries.

## Schema

```sql
CREATE TABLE IF NOT EXISTS creator_memory (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('semantic', 'preference', 'fact', 'decision')),
  key_name TEXT NOT NULL,
  value_json TEXT NOT NULL,
  relevance_score REAL DEFAULT 1.0,
  access_count INTEGER DEFAULT 0,
  last_accessed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER,
  UNIQUE(tenant_id, type, key_name)
);

-- Index for tenant-scoped queries (most common access pattern)
CREATE INDEX IF NOT EXISTS idx_creator_memory_tenant
  ON creator_memory(tenant_id, type, relevance_score DESC);

-- Index for expiration pruning
CREATE INDEX IF NOT EXISTS idx_creator_memory_expires
  ON creator_memory(expires_at) WHERE expires_at IS NOT NULL;

-- Index for dedup queries (consolidator)
CREATE INDEX IF NOT EXISTS idx_creator_memory_dedup
  ON creator_memory(tenant_id, type, key_name);
```

## Migration File

```sql
-- migrations/0188_creator_memory.sql
-- Phase 7: Memory Consolidation — creator_memory table

CREATE TABLE IF NOT EXISTS creator_memory (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('semantic', 'preference', 'fact', 'decision')),
  key_name TEXT NOT NULL,
  value_json TEXT NOT NULL,
  relevance_score REAL DEFAULT 1.0,
  access_count INTEGER DEFAULT 0,
  last_accessed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER,
  UNIQUE(tenant_id, type, key_name)
);

CREATE INDEX IF NOT EXISTS idx_creator_memory_tenant
  ON creator_memory(tenant_id, type, relevance_score DESC);

CREATE INDEX IF NOT EXISTS idx_creator_memory_expires
  ON creator_memory(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_creator_memory_dedup
  ON creator_memory(tenant_id, type, key_name);
```

## D1 Client Access

The existing `memory-adapter.ts` in `land/openclaw/` uses `getD1()` (sync). The new `creator_memory` table is accessed directly via D1 queries in `forest/memory/` modules — no new adapter needed. Direct `db.prepare(...)` calls are consistent with existing patterns.

## Existing memory_kv Table

The existing `memory_kv` table (used by `land/openclaw/memory-adapter.ts`) remains unchanged. It stores generic key-value data for the OpenClaw orchestrator. The new `creator_memory` table is purpose-built for the agent-chat memory consolidation system with:
- Relevance scoring
- Access counting
- TTL expiration
- Type categorization (semantic/preference/fact/decision)

These are separate concerns — no migration of existing data needed.

## Apply Command

```bash
cd apps/sophia-ai-factory
npx wrangler d1 execute sophia-raas-db --file=migrations/0188_creator_memory.sql --remote
```

## Risks

- D1 supports `CHECK` constraints but enforcement may vary — use as documentation, not enforcement.
- `WHERE expires_at IS NOT NULL` in index is valid SQLite syntax.
- Migration number `0188` follows existing sequence (last is `0187`).
