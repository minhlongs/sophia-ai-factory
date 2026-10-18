/**
 * CreativeMemoryStore — adapter implementing ICreativeMemoryStore over the
 * existing tree/creative-memory repository functions.
 *
 * Layer: tree. Imports seed only (types, result, db client). Wraps, does not
 * rewrite: persistence delegates to upsertMemory / deleteMemory / etc.
 * summarize() is deterministic token-bounded truncation — no LLM call, no
 * hard-coded model.
 *
 * @module tree/creative-memory/creative-memory-store
 */

import type { CreativeMemory } from '@/seed/types/creative-domain';
import type {
  CreativeMemoryEntryId,
  ICreativeMemoryStore,
  MemoryQuery,
  MemorySummary,
} from '@/seed/types/creative-economy';
import { success, failure, type Result } from '@/seed/types/result';
import { createCreativeMemoryEntryId } from '@/seed/types/creative-economy';
import { toError } from '@/seed/utils/to-error';
import {
  upsertMemory,
  deleteMemory,
  newMemoryId,
  CreativeMemoryError,
} from './types';
import { fetchMemoryById, executeMemoryQuery } from './creative-memory-queries';

const DEFAULT_QUERY_LIMIT = 50;
const CHARS_PER_TOKEN = 4;

export class CreativeMemoryStore implements ICreativeMemoryStore {
  async get(id: CreativeMemoryEntryId): Promise<Result<CreativeMemory, Error>> {
    try {
      const entry = await fetchMemoryById(id);
      if (!entry) {
        return failure(new CreativeMemoryError('NOT_FOUND', `Memory not found: ${id}`));
      }
      return success(entry);
    } catch (err) {
      return failure(toError(err));
    }
  }

  async query(query: MemoryQuery): Promise<Result<MemorySummary, Error>> {
    try {
      const entries = await executeMemoryQuery(query);
      return success({ entries, total: entries.length });
    } catch (err) {
      return failure(toError(err));
    }
  }

  async put(
    entry: Omit<CreativeMemory, 'id' | 'version' | 'createdAt' | 'updatedAt'>,
  ): Promise<Result<CreativeMemoryEntryId, Error>> {
    try {
      const saved = await upsertMemory({
        ...entry,
        id: newMemoryId(),
        version: 0,
        isDeleted: false,
        createdAt: 0,
        updatedAt: 0,
      });
      return success(createCreativeMemoryEntryId(saved.id));
    } catch (err) {
      return failure(toError(err));
    }
  }

  async delete(id: CreativeMemoryEntryId): Promise<Result<boolean, Error>> {
    try {
      const existing = await fetchMemoryById(id);
      if (!existing) return success(false);
      await deleteMemory(id);
      return success(true);
    } catch (err) {
      return failure(toError(err));
    }
  }

  async summarize(query: MemoryQuery, maxTokens: number): Promise<Result<string, Error>> {
    try {
      const entries = await executeMemoryQuery({
        ...query,
        limit: query.limit ?? DEFAULT_QUERY_LIMIT,
      });
      const lines = entries.map((e) => {
        const scopePart = e.scopeId ? ` ${e.scope}(${e.scopeId})` : ` ${e.scope}`;
        return `[${e.category}/${e.key}]${scopePart}: ${JSON.stringify(e.value)}`;
      });
      const text = lines.join('\n');
      if (maxTokens <= 0) return success('');
      const maxChars = maxTokens * CHARS_PER_TOKEN;
      if (text.length <= maxChars) return success(text);
      return success(text.slice(0, maxChars) + '…');
    } catch (err) {
      return failure(toError(err));
    }
  }
}

export const creativeMemoryStore = new CreativeMemoryStore();
