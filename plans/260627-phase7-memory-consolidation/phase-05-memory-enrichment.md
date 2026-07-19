# Phase 05: Memory Enrichment
**Status:** completed

**Layer:** forest (infrastructure orchestrator) → land (integration)
**Dependencies:** Phase 06 (creator_memory table), Phase 02 (ConversationSummarizer for LLM access)
**Files to create:**
- `src/forest/memory/memory-enrichment.ts`
- `src/forest/memory/memory-enrichment.test.ts`

**Inngest function:** `src/forest/inngest/functions/memory-enrichment.ts`

---

## Requirements

After each chat session, extract key facts/preferences and store as `creator_memory` entries (semantic + preference types). Runs as an Inngest function triggered after chat session ends.

## Architecture

```
MemoryEnricher
├── extractFacts(messages: ChatMessage[], locale): Promise<MemoryEntry[]>
├── extractPreferences(messages: ChatMessage[], locale): Promise<MemoryEntry[]>
├── storeMemories(tenantId, entries): Promise<void>
└── buildExtractionPrompt(messages, type): string
```

## Memory Entry Schema

```typescript
interface MemoryEntry {
  type: 'semantic' | 'preference' | 'fact' | 'decision';
  key: string;                    // normalized key for dedup
  value: Record<string, unknown>; // structured data
  ttlDays?: number;               // optional expiration
}
```

## Implementation

```typescript
// src/forest/memory/memory-enrichment.ts

import type { ChatMessage } from '@/land/agent-chat/types';
import { getD1 } from '@/seed/db/client';
import { createLogger } from '@/seed/utils/logger-utility';

const logger = createLogger('forest/memory');

export interface MemoryEntry {
  type: 'semantic' | 'preference' | 'fact' | 'decision';
  key: string;
  value: Record<string, unknown>;
  ttlDays?: number;
}

export interface EnrichmentResult {
  factsExtracted: number;
  preferencesExtracted: number;
  stored: number;
  skipped: number;
}

const FACT_EXTRACTION_PROMPT = `Extract key facts from this conversation. Return a JSON array of objects with: key (short slug), value (the fact), type always "fact". Max 5 facts. Example: [{"key":"industry","value":"e-commerce","type":"fact"}]. Return ONLY valid JSON array, no explanation.`;

const PREFERENCE_EXTRACTION_PROMPT = `Extract user preferences from this conversation. Return a JSON array of objects with: key (short slug), value (the preference), type always "preference". Max 3 preferences. Example: [{"key":"language","value":"vietnamese","type":"preference"}]. Return ONLY valid JSON array, no explanation.`;

export class MemoryEnricher {
  private resolveLlmRoute: () => Promise<{
    provider: string;
    baseUrl: string;
    apiKey: string;
    model: string;
  }>;

  constructor(resolveLlmRoute: () => Promise<{ provider: string; baseUrl: string; apiKey: string; model: string }>) {
    this.resolveLlmRoute = resolveLlmRoute;
  }

  /**
   * Main entry: enrich a conversation session and store memories.
   */
  async enrichSession(
    tenantId: string,
    messages: ChatMessage[],
    locale: 'en' | 'vi' = 'en',
  ): Promise<EnrichmentResult> {
    if (messages.length < 2) {
      return { factsExtracted: 0, preferencesExtracted: 0, stored: 0, skipped: 0 };
    }

    const [facts, preferences] = await Promise.all([
      this.extractFacts(messages, locale),
      this.extractPreferences(messages, locale),
    ]);

    const allEntries: MemoryEntry[] = [...facts, ...preferences];
    const result = await this.storeMemories(tenantId, allEntries);

    logger.info('memory-enrichment.complete', undefined, {
      tenantId,
      factsExtracted: facts.length,
      preferencesExtracted: preferences.length,
      ...result,
    });

    return {
      factsExtracted: facts.length,
      preferencesExtracted: preferences.length,
      ...result,
    };
  }

  async extractFacts(messages: ChatMessage[], locale: string): Promise<MemoryEntry[]> {
    return this.callExtractionLlm(messages, FACT_EXTRACTION_PROMPT, locale);
  }

  async extractPreferences(messages: ChatMessage[], locale: string): Promise<MemoryEntry[]> {
    return this.callExtractionLlm(messages, PREFERENCE_EXTRACTION_PROMPT, locale);
  }

  private async callExtractionLlm(
    messages: ChatMessage[],
    systemPrompt: string,
    locale: string,
  ): Promise<MemoryEntry[]> {
    try {
      const route = await this.resolveLlmRoute();
      const conversationText = messages
        .map(m => `[${m.role}]: ${m.content}`)
        .join('\n');

      const response = await fetch(`${route.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${route.apiKey}`,
        },
        body: JSON.stringify({
          model: route.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: conversationText },
          ],
          max_tokens: 256,
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        logger.warn('memory-enrichment.llm-failed', undefined, {
          status: response.status,
          provider: route.provider,
        });
        return [];
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content?.trim() ?? '[]';

      // Parse JSON array from LLM response
      const parsed = JSON.parse(content);
      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter((item: unknown) => {
          const entry = item as Record<string, unknown>;
          return typeof entry.key === 'string' && typeof entry.value !== 'undefined';
        })
        .map((item: Record<string, unknown>) => ({
          type: (item.type as MemoryEntry['type']) ?? 'semantic',
          key: item.key as string,
          value: typeof item.value === 'string' ? { text: item.value } : (item.value as Record<string, unknown>),
          ttlDays: item.ttlDays as number | undefined,
        }));
    } catch (err) {
      logger.error('memory-enrichment.extraction-error', err as Error, { locale });
      return [];
    }
  }

  /**
   * Store extracted memories to creator_memory table via D1.
   * Uses upsert to avoid duplicates.
   */
  async storeMemories(tenantId: string, entries: MemoryEntry[]): Promise<EnrichmentResult> {
    const db = getD1();
    if (!db) throw new Error('D1 database binding not available');

    let stored = 0;
    let skipped = 0;

    for (const entry of entries) {
      const id = `${tenantId}:${entry.type}:${entry.key}`;
      const now = Date.now();
      const ttl = entry.ttlDays ? now + entry.ttlDays * 24 * 60 * 60 * 1000 : null;
      const valueJson = JSON.stringify(entry.value);

      try {
        const result = await db
          .prepare(`
            INSERT INTO creator_memory (id, tenant_id, type, key_name, value_json, relevance_score, access_count, created_at, updated_at, expires_at)
            VALUES (?, ?, ?, ?, ?, 1.0, 0, ?, ?, ?)
            ON CONFLICT(tenant_id, type, key_name) DO UPDATE SET
              value_json = excluded.value_json,
              updated_at = excluded.updated_at,
              expires_at = excluded.expires_at
          `)
          .bind(id, tenantId, entry.type, entry.key, valueJson, now, now, ttl)
          .run();

        if (result.changes === 1) {
          stored++;
        } else {
          skipped++;
        }
      } catch (err) {
        logger.warn('memory-enrichment.store-failed', err as Error, {
          tenantId,
          key: entry.key,
        });
        skipped++;
      }
    }

    return { stored, skipped };
  }
}
```

## Inngest Function

```typescript
// src/forest/inngest/functions/memory-enrichment.ts

import { inngest } from '../client';
import { MemoryEnricher } from '@/forest/memory/memory-enrichment';
import { resolveLlmRoute } from '@/land/agent-chat/llm-router';
import { createLogger } from '@/seed/utils/logger-utility';

const logger = createLogger('forest/inngest/memory-enrichment');

export const memoryEnrichmentJob = inngest.createFunction(
  {
    id: 'memory-enrichment',
    retries: 2,
  },
  { event: 'chat/session-ended' },
  async ({ event, step }) => {
    const { tenantId, messages, locale } = event.data;

    const enricher = new MemoryEnricher(async () => resolveLlmRoute(tenantId));

    const result = await step.run('enrich-memories', async () => {
      return enricher.enrichSession(tenantId, messages as Array<{ role: string; content: string }>, locale);
    });

    logger.info('memory-enrichment.job-complete', undefined, {
      tenantId,
      result,
    });

    return result;
  },
);
```

## Trigger Point

After chat session ends (client sends `session-ended` event or API route calls `inngest.send('chat/session-ended', {...})`):

```typescript
// In the agent-chat API route, after streaming completes:
await inngest.send('chat/session-ended', {
  tenantId,
  messages: finalMessages,
  locale: context.locale ?? 'en',
});
```

## Tests

```typescript
// src/forest/memory/memory-enrichment.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryEnricher } from './memory-enrichment';

describe('MemoryEnricher', () => {
  let enricher: MemoryEnricher;
  let mockResolve: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockResolve = vi.fn().mockResolvedValue({
      provider: 'deepseek',
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: 'test-key',
      model: 'deepseek-reasoner',
    });
    enricher = new MemoryEnricher(mockResolve);
  });

  it('returns zero result for empty messages', async () => {
    const result = await enricher.enrichSession('t1', []);
    expect(result).toEqual({ factsExtracted: 0, preferencesExtracted: 0, stored: 0, skipped: 0 });
  });

  it('returns zero result for single message', async () => {
    const result = await enricher.enrichSession('t1', [{ role: 'user', content: 'hi' }]);
    expect(result).toEqual({ factsExtracted: 0, preferencesExtracted: 0, stored: 0, skipped: 0 });
  });

  it('extracts facts from LLM response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{
          message: { content: '[{"key":"industry","value":"e-commerce","type":"fact"}]' },
        }],
      }),
    });
    global.fetch = fetchMock;

    const facts = await enricher.extractFacts(
      [{ role: 'user', content: 'I run an e-commerce store' }],
      'en',
    );

    expect(facts).toHaveLength(1);
    expect(facts[0].key).toBe('industry');
    expect(facts[0].value).toEqual({ text: 'e-commerce' });
  });

  it('handles malformed LLM JSON gracefully', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: 'not valid json' } }],
      }),
    });
    global.fetch = fetchMock;

    const facts = await enricher.extractFacts(
      [{ role: 'user', content: 'hello' }],
      'en',
    );

    expect(facts).toHaveLength(0);
  });

  it('extracts preferences separately', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{
          message: { content: '[{"key":"lang","value":"vi","type":"preference"}]' },
        }],
      }),
    });
    global.fetch = fetchMock;

    const prefs = await enricher.extractPreferences(
      [{ role: 'user', content: 'Tôi thích dùng tiếng Việt' }],
      'vi',
    );

    expect(prefs).toHaveLength(1);
    expect(prefs[0].type).toBe('preference');
  });
});
```

## Risks

- LLM extraction is best-effort; malformed JSON is caught and logged.
- D1 upsert uses `ON CONFLICT(tenant_id, type, key_name)` — requires unique index from migration.
- Inngest event `chat/session-ended` must be sent from the API route after streaming completes.
