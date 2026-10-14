/**
 * IP Graph Helpers — Error class, ID generator, and D1 row mapper.
 * Layer: tree (domain-specific reusable)
 *
 * @module tree/ip-graph/ip-graph-mappers
 */

import type { IP } from '@/seed/types/creative-domain';

export class IPGraphError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'IPGraphError';
    this.code = code;
  }
}

export function newIpId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return 'ip_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export interface IPRow {
  id: string;
  workspace_id: string;
  type: string;
  name: string;
  description: string;
  metadata: string;
  parent_id: string | null;
  status: string;
  created_at: number;
  updated_at: number;
}

export function rowToDomain(row: IPRow): IP {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    type: row.type as IP['type'],
    name: row.name,
    description: row.description,
    metadata: JSON.parse(row.metadata) as Record<string, unknown>,
    parentId: row.parent_id ?? undefined,
    status: row.status as IP['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
