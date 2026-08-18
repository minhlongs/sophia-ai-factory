/**
 * Unit tests for src/tree/ip-graph/types.ts
 */
import { describe, it, expect, vi } from 'vitest';
import { getD1 } from '@/seed/db/client';

// Mock getD1 for unit tests
vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
}));

import { createIP, getIP, listIP, getIPChildren, updateIPStatus, newIpId, IPGraphError } from '../types';

const mockGetD1 = vi.mocked(getD1);

function mockDb() {
  const rows: Record<string, unknown>[] = [];
  const mockDb = {
    prepare: vi.fn((sql: string) => {
      const stmt = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(rows[0] ?? null),
        all: vi.fn().mockResolvedValue({ results: rows }),
        run: vi.fn().mockResolvedValue({ changes: rows.length }),
      };
      return stmt;
    }),
    _setRows: (r: Record<string, unknown>[]) => { rows.length = 0; rows.push(...r); },
  };
  mockGetD1.mockReturnValue(mockDb as never);
  return mockDb;
}

describe('ip-graph types', () => {
  describe('newIpId', () => {
    it('generates id with ip_ prefix', () => {
      const id = newIpId();
      expect(id.startsWith('ip_')).toBe(true);
      expect(id.length).toBeGreaterThan(5);
    });
  });

  describe('createIP', () => {
    it('creates IP entity and returns it', async () => {
      mockDb();
      const ip = await createIP({
        id: 'ip_test1',
        workspaceId: 'ws_1',
        type: 'universe',
        name: 'Test Universe',
        description: 'A test',
        metadata: {},
        status: 'draft',
        createdAt: 1000,
        updatedAt: 1000,
      });

      expect(ip.id).toBe('ip_test1');
      expect(ip.type).toBe('universe');
      expect(ip.name).toBe('Test Universe');
      expect(ip.status).toBe('draft');
    });

    it('throws IPGraphError when D1 unavailable', async () => {
      mockGetD1.mockReturnValueOnce(null as never);
      await expect(
        createIP({
          id: 'ip_test2',
          workspaceId: 'ws_1',
          type: 'character',
          name: 'Char',
          description: '',
          metadata: {},
          status: 'draft',
          createdAt: 0,
          updatedAt: 0,
        } as Parameters<typeof createIP>[0]),
      ).rejects.toThrow(IPGraphError);
    });
  });

  describe('getIP', () => {
    it('returns null when not found', async () => {
      mockDb();
      const result = await getIP('ip_nonexistent');
      expect(result).toBeNull();
    });

    it('returns IP when found', async () => {
      const db = mockDb();
      db._setRows([
        { id: 'ip_1', workspace_id: 'ws_1', type: 'series', name: 'My Series', description: '', metadata: '{}', status: 'draft', parent_id: null, created_at: 1000, updated_at: 1000 },
      ]);

      const result = await getIP('ip_1');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('My Series');
    });
  });

  describe('listIP', () => {
    it('lists IP entities for workspace', async () => {
      const db = mockDb();
      db._setRows([
        { id: 'ip_1', workspace_id: 'ws_1', type: 'universe', name: 'U1', description: '', metadata: '{}', status: 'draft', parent_id: null, created_at: 1, updated_at: 1 },
        { id: 'ip_2', workspace_id: 'ws_1', type: 'series', name: 'S1', description: '', metadata: '{}', status: 'draft', parent_id: 'ip_1', created_at: 2, updated_at: 2 },
      ]);

      const result = await listIP('ws_1');
      expect(result).toHaveLength(2);
    });

    it('filters by type', async () => {
      const db = mockDb();
      db._setRows([
        { id: 'ip_1', workspace_id: 'ws_1', type: 'universe', name: 'U1', description: '', metadata: '{}', status: 'draft', parent_id: null, created_at: 1, updated_at: 1 },
      ]);

      const result = await listIP('ws_1', 'universe');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('universe');
    });
  });

  describe('getIPChildren', () => {
    it('returns children of a parent', async () => {
      const db = mockDb();
      db._setRows([
        { id: 'ip_c1', workspace_id: 'ws_1', type: 'character', name: 'Hero', description: '', metadata: '{}', status: 'draft', parent_id: 'ip_1', created_at: 3, updated_at: 3 },
      ]);

      const children = await getIPChildren('ip_1');
      expect(children).toHaveLength(1);
      expect(children[0].type).toBe('character');
    });
  });

  describe('updateIPStatus', () => {
    it('updates status and returns updated entity', async () => {
      const db = mockDb();
      db._setRows([
        { id: 'ip_1', workspace_id: 'ws_1', type: 'universe', name: 'U1', description: '', metadata: '{}', status: 'approved', parent_id: null, created_at: 1, updated_at: 999 },
      ]);

      const updated = await updateIPStatus('ip_1', 'approved');
      expect(updated).not.toBeNull();
      expect(updated!.status).toBe('approved');
    });
  });
});