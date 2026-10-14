/**
 * Creative Memory Error Classes & Domain Mappers
 *
 * Layer: tree/creative-memory/types
 */

import type {
  CreativeMemory,
  MemoryCategory,
  MemoryConfidence,
} from '@/seed/types/creative-domain';

export class CreativeMemoryError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'CreativeMemoryError';
    this.code = code;
  }
}

export function newMemoryId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return 'mem_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export interface CreativeMemoryRow {
  id: string;
  workspace_id: string;
  category: string;
  key: string;
  value: string;
  confidence: string;
  source: string;
  evidence: string;
  scope: string;
  scope_id: string | null;
  version: number;
  is_deleted: number;
  created_at: number;
  updated_at: number;
  expires_at: number | null;
}

export function memoryRowToDomain(row: CreativeMemoryRow | Record<string, unknown>): CreativeMemory {
  const r = row as unknown as CreativeMemoryRow;
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    category: r.category as MemoryCategory,
    key: r.key,
    value: typeof r.value === 'string' ? JSON.parse(r.value) : r.value,
    confidence: r.confidence as MemoryConfidence,
    source: r.source,
    evidence: r.evidence,
    scope: r.scope as CreativeMemory['scope'],
    scopeId: r.scope_id ?? undefined,
    version: r.version,
    isDeleted: r.is_deleted === 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    expiresAt: r.expires_at ?? undefined,
  };
}
