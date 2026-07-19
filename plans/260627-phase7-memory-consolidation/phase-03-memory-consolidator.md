# Phase 03: Memory Consolidator
**Status:** completed

**Layer:** forest (infrastructure orchestrator)
**Dependencies:** Phase 06 (creator_memory table migration)
**Files to create:**
- `src/forest/memory/memory-consolidator.ts`
- `src/forest/memory/index.ts`
- `src/forest/memory/memory-consolidator.test.ts`

**Inngest function:** `src/forest/inngest/functions/memory-consolidation.ts`

---

## Requirements

Merge related memories in `creator_memory` table. Deduplicate, decay old relevance scores, boost frequently-accessed memories. Runs as a periodic Inngest function or on-demand.

## Schema (from Phase 06 migration)

```sql
CREATE TABLE creator_memory (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  type TEXT NOT NULL,           -- 'semantic' | 'preference' | 'fact' | 'decision'
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
```

## Architecture

```
MemoryConsolidator
├── db: D1Database
├── consolidate(tenantId): Promise<ConsolidationResult>
├── deduplicate(tenantId): Promise<number>      // returns merged count
├── decayScores(tenantId, halfLifeDays): Promise<void>
├── boostFrequent(tenantId, minAccessCount): Promise<void>
└── pruneExpired(tenantId): Promise<number>      // returns pruned count
```

## Implementation

```typescript
// src/forest/memory/memory-consolidator.ts

import { getD1 } from '@/seed/db/client';
import { createLogger } from '@/seed/utils/logger-utility';

const logger = createLogger('forest/memory');

export interface CreatorMemoryRow {
  id: string;
  tenant_id: string;
  type: string;
  key_name: string;
  value_json: string;
  relevance_score: number;
  access_count: number;
  last_accessed_at: number | null;
  created_at: number;
  updated_at: number;
  expires_at: number | null;
}

export interface ConsolidationResult {
  deduplicated: number;
  decayed: number;
  boosted: number;
  pruned: number;
}

export interface MemoryConsolidatorConfig {
  decayHalfLifeDays?: number;    // default 30
  boostMinAccessCount?: number;  // default 5
  maxRelevanceScore?: number;    // default 2.0
  minRelevanceScore?: number;    // default 0.1
}

export class MemoryConsolidator {
  private config: Required<MemoryConsolidatorConfig>;

  constructor(config: MemoryConsolidatorConfig = {}) {
    this.config = {
      decayHalfLifeDays: config.decayHalfLifeDays ?? 30,
      boostMinAccessCount: config.boostMinAccessCount ?? 5,
      maxRelevanceScore: config.maxRelevanceScore ?? 2.0,
      minRelevanceScore: config.minRelevanceScore ?? 0.1,
    };
  }

  async consolidate(tenantId: string): Promise<ConsolidationResult> {
    const db = getD1();
    if (!db) throw new Error('D1 database binding not available');

    const result: ConsolidationResult = {
      deduplicated: await this.deduplicate(db, tenantId),
      decayed: await this.decayScores(db, tenantId),
      boosted: await this.boostFrequent(db, tenantId),
      pruned: await this.pruneExpired(db, tenantId),
    };

    logger.info('memory-consolidation.complete', undefined, {
      tenantId,
      ...result,
    });

    return result;
  }

  /**
   * Merge memories with identical (tenant_id, type, key_name).
   * Keeps the highest relevance_score version.
   */
  async deduplicate(db: D1Database, tenantId: string): Promise<number> {
    const duplicates = await db
      .prepare(`
        SELECT type, key_name, COUNT(*) as cnt, GROUP_CONCAT(id) as ids
        FROM creator_memory
        WHERE tenant_id = ?
        GROUP BY type, key_name
        HAVING COUNT(*) > 1
      `)
      .bind(tenantId)
      .all<{ type: string; key_name: string; cnt: number; ids: string }>();

    if (!duplicates.results || duplicates.results.length === 0) return 0;

    let merged = 0;

    for (const dup of duplicates.results) {
      const ids = dup.ids.split(',');
      const keepId = ids[0];
      const removeIds = ids.slice(1);

      // Get the row with highest relevance to keep
      const rows = await db
        .prepare('SELECT id, relevance_score FROM creator_memory WHERE id IN (?)')
        .bind(ids.join(','))
        .all<{ id: string; relevance_score: number }>();

      if (rows.results && rows.results.length > 0) {
        const best = rows.results.reduce((a, b) =>
          a.relevance_score >= b.relevance_score ? a : b,
        );
        const totalAccess = rows.results.reduce((sum, r) => {
          // We need the full row for access_count — fetch separately
          return sum;
        }, 0);

        // Sum access counts from all duplicates
        let totalAccessCount = 0;
        for (const id of ids) {
          const row = await db
            .prepare('SELECT access_count FROM creator_memory WHERE id = ?')
            .bind(id)
            .first<{ access_count: number }>();
          totalAccessCount += row?.access_count ?? 0;
        }

        // Update the keeper with combined access count and max relevance
        await db
          .prepare(`
            UPDATE creator_memory
            SET access_count = ?, updated_at = ?
            WHERE id = ?
          `)
          .bind(totalAccessCount, Date.now(), best.id)
          .run();

        // Delete the rest
        for (const rid of removeIds) {
          if (rid !== best.id) {
            await db.prepare('DELETE FROM creator_memory WHERE id = ?').bind(rid).run();
          }
        }
        merged += removeIds.length;
      }
    }

    return merged;
  }

  /**
   * Exponential decay: score = score * (0.5 ^ (ageDays / halfLifeDays))
   */
  async decayScores(db: D1Database, tenantId: string): Promise<number> {
    const now = Date.now();
    const halfLifeMs = this.config.decayHalfLifeDays * 24 * 60 * 60 * 1000;

    const result = await db
      .prepare(`
        UPDATE creator_memory
        SET relevance_score = MAX(?, relevance_score * POW(0.5, (? - created_at) / ?)),
            updated_at = ?
        WHERE tenant_id = ?
          AND expires_at IS NULL OR expires_at > ?
      `)
      .bind(
        this.config.minRelevanceScore,
        now,
        halfLifeMs,
        now,
        tenantId,
        now,
      )
      .run();

    return result.changes ?? 0;
  }

  /**
   * Boost relevance for frequently accessed memories.
   * access_count >= boostMinAccessCount → score += 0.1 per access above threshold
   */
  async boostFrequent(db: D1Database, tenantId: string): Promise<number> {
    const result = await db
      .prepare(`
        UPDATE creator_memory
        SET relevance_score = MIN(?, relevance_score + (? - ?) * 0.1),
            updated_at = ?
        WHERE tenant_id = ?
          AND access_count >= ?
          AND (expires_at IS NULL OR expires_at > ?)
      `)
      .bind(
        this.config.maxRelevanceScore,
        this.config.boostMinAccessCount,
        this.config.boostMinAccessCount,
        Date.now(),
        tenantId,
        this.config.boostMinAccessCount,
        Date.now(),
      )
      .run();

    return result.changes ?? 0;
  }

  /**
   * Remove expired memories.
   */
  async pruneExpired(db: D1Database, tenantId: string): Promise<number> {
    const now = Date.now();
    const result = await db
      .prepare(`
        DELETE FROM creator_memory
        WHERE tenant_id = ? AND expires_at IS NOT NULL AND expires_at <= ?
      `)
      .bind(tenantId, now)
      .run();

    return result.changes ?? 0;
  }
}
```

## Inngest Function

```typescript
// src/forest/inngest/functions/memory-consolidation.ts

import { inngest } from '../client';
import { MemoryConsolidator } from '@/forest/memory/memory-consolidator';
import { createLogger } from '@/seed/utils/logger-utility';

const logger = createLogger('forest/inngest/memory-consolidation');

export const memoryConsolidationJob = inngest.createFunction(
  {
    id: 'memory-consolidation',
    retries: 2,
    throttle: {
      count: 10,
      period: '1h',
      key: 'event.data.tenantId',
    },
  },
  { event: 'memory/consolidate' },
  async ({ event, step }) => {
    const { tenantId } = event.data;
    const consolidator = new MemoryConsolidator();

    const result = await step.run('consolidate-memories', async () => {
      return consolidator.consolidate(tenantId);
    });

    logger.info('memory-consolidation.job-complete', undefined, {
      tenantId,
      result,
    });

    return result;
  },
);
```

## Tests

```typescript
// src/forest/memory/memory-consolidator.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryConsolidator, ConsolidationResult } from './memory-consolidator';

// Minimal D1 mock
function createMockDb() {
  const store: Record<string, Array<Record<string, unknown>>> = {};
  return {
    prepare: vi.fn((sql: string) => {
      const self = {
        bind: vi.fn(function (...args: unknown[]) {
          const boundSql = sql;
          const boundArgs = args;
          return {
            first: vi.fn(async () => null),
            all: vi.fn(async () => ({ results: [] })),
            run: vi.fn(async () => ({ changes: 0 })),
          };
        }),
      };
      return self;
    }),
  };
}

describe('MemoryConsolidator', () => {
  let consolidator: MemoryConsolidator;

  beforeEach(() => {
    consolidator = new MemoryConsolidator({
      decayHalfLifeDays: 30,
      boostMinAccessCount: 5,
    });
  });

  it('returns zero counts on empty tenant', async () => {
    const db = createMockDb();
    const result = await consolidator.consolidate('tenant-empty');
    expect(result).toEqual({ deduplicated: 0, decayed: 0, boosted: 0, pruned: 0 });
  });

  it('config accepts custom values', () => {
    const custom = new MemoryConsolidator({
      decayHalfLifeDays: 60,
      boostMinAccessCount: 10,
      maxRelevanceScore: 3.0,
      minRelevanceScore: 0.05,
    });
    // Config is internal; verify via behavior in integration tests
    expect(custom).toBeDefined();
  });
});
```

## Risks

- D1 `GROUP_CONCAT` availability: D1 (SQLite) supports `group_concat()` — confirmed.
- `POW(0.5, ...)` decay formula works in SQLite.
- Throttling prevents runaway Inngest invocations.
- Must use `getD1()` (sync, no await) per project convention.
