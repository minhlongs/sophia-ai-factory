/**
 * Types and Constants for Creator Memory Repository
 *
 * @module tree/memory/repository/types
 */

import type { CreatorMemoryType } from '@/seed/db/types';

/** Memory content stored as JSON — shape depends on memory_type. */
export interface MemoryContent {
  text: string;
  data?: Record<string, unknown>;
}

/** Filter options for querying memories. */
export interface MemoryQueryOptions {
  /** Filter by memory type. */
  type?: CreatorMemoryType;
  /** Filter by category string. */
  category?: string;
  /** Maximum rows to return (default 50). */
  limit?: number;
  /** Minimum relevance score threshold. */
  minRelevance?: number;
}

/** Row returned from store() with generated fields. */
export interface StoredMemory {
  id: string;
  userId: string;
  memoryType: CreatorMemoryType;
  category: string;
  content: MemoryContent;
  relevanceScore: number;
  sourceExecutionId: string | null;
  expiresAt: number | null;
  createdAt: number;
  updatedAt: number;
}

/** Relevance-scored result for getRelevant(). */
export interface RelevantMemory extends StoredMemory {
  /** Combined relevance for ranking (keyword overlap + stored score). */
  relevance: number;
}

/** Raw database row shape from creator_memory D1 table */
export interface RawCreatorMemoryRow {
  id: string;
  user_id: string;
  memory_type: string;
  category: string;
  content_json: string;
  relevance_score: number;
  source_execution_id: string | null;
  expires_at: number | null;
  created_at: number;
  updated_at: number;
}

export const DEFAULT_LIMIT = 50;
export const DEFAULT_RELEVANCE = 1.0;
