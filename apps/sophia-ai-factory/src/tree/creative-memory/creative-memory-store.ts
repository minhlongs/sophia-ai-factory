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
import { getD1 } from '@/seed/db/client';
import { toError } from '@/seed/utils/to-error';
import {
  upsertMemory,
  deleteMemory,
  newMemoryId,
  memoryRowToDomain,
  CreativeMemoryError,
} from './types';

const DEFAULT_QUERY_LIMIT = 50;
const CHARS_PER_TOKEN = 4;

export class CreativeMemoryStore implements ICreativeMemoryStore {
  async get(id: CreativeMemoryEntryId): Promise<Result<CreativeMemory, Error>> {
    try {
      const entry = await this.getMemoryById(id);
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
      const entries = await this.queryMemory(query);
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
      const existing = await this.getMemoryById(id);
      if (!existing) return success(false);
      await deleteMemory(id);
      return success(true);
    } catch (err) {
      return failure(toError(err));
    }
  }

  async summarize(query: MemoryQuery, maxTokens: number): Promise<Result<string, Error>> {
    try {
      const entries = await this.queryMemory({ ...query, limit: query.limit ?? DEFAULT_QUERY_LIMIT });
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

  private async getMemoryById(id: string): Promise<CreativeMemory | null> {
    const db = await getD1();
    if (!db) throw new CreativeMemoryError('D1_UNAVAILABLE', 'D1 not available');
    const row = await db
      .prepare(
        `SELECT id, workspace_id, category, key, value, confidence, source,
                evidence, scope, scope_id, version, is_deleted,
                created_at, updated_at, expires_at
         FROM creative_memory
         WHERE id = ?1 AND is_deleted = 0`,
      )
      .bind(id)
      .first<Parameters<typeof memoryRowToDomain>[0]>();
    if (!row) return null;
    return memoryRowToDomain(row);
  }

  private async queryMemory(query: MemoryQuery): Promise<CreativeMemory[]> {
    const db = await getD1();
    if (!db) throw new CreativeMemoryError('D1_UNAVAILABLE', 'D1 not available');
    const now = Math.floor(Date.now() / 1000);
    const params: unknown[] = [query.workspaceId, now];
    let sql =
      `SELECT * FROM creative_memory` +
      ` WHERE workspace_id = ?1 AND is_deleted = 0` +
      ` AND (expires_at IS NULL OR expires_at > ?2)`;
    if (query.category) {
      sql += ` AND category = ?${params.length + 1}`;
      params.push(query.category);
    }
    if (query.key) {
      sql += ` AND key = ?${params.length + 1}`;
      params.push(query.key);
    }
    sql += ` AND (scope = ?${params.length + 1} OR (?${params.length + 1} IS NULL))`;
    params.push(query.scope ?? null);
    sql +=
      ` AND (scope_id = ?${params.length + 1} OR (scope_id IS NULL AND ?${params.length + 1} IS NULL))`;
    params.push(query.scopeId ?? null);
    sql += ` ORDER BY updated_at DESC, id DESC`;
    if (query.limit) {
      sql += ` LIMIT ?${params.length + 1}`;
      params.push(query.limit);
    }
    const result = await db
      .prepare(sql)
      .bind(...params)
      .all<Parameters<typeof memoryRowToDomain>[0]>();
    return (result.results ?? []).map(memoryRowToDomain);
  }
}

export const creativeMemoryStore = new CreativeMemoryStore();