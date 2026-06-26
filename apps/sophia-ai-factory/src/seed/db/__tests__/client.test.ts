/**
 * Unit tests for D1 database client
 * @module seed/db/__tests__/client.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { D1Client } from '../client';
import type { D1Database, D1PreparedStatement, D1Result } from '@cloudflare/workers-types';

// Mock D1PreparedStatement
const createMockStmt = (): D1PreparedStatement => ({
  bind: vi.fn(function(this: D1PreparedStatement) { return this; }),
  first: vi.fn(),
  all: vi.fn(),
  run: vi.fn(),
  raw: vi.fn(),
});

// Mock D1Database
const createMockDbInstance = (): D1Database => ({
  prepare: vi.fn(() => createMockStmt()),
  batch: vi.fn(() => Promise.resolve([])),
  exec: vi.fn(),
  withSession: vi.fn(),
  dump: vi.fn(),
});

describe('D1Client', () => {
  let mockDb: D1Database;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDbInstance();
  });

  describe('prepare & bind', () => {
    it('should allow prepare statements', () => {
      const client = new D1Client(mockDb);
      const stmt = client.prepare('SELECT * FROM users WHERE id = ?');

      expect(stmt).toBeDefined();
      expect(mockDb.prepare).toHaveBeenCalledWith('SELECT * FROM users WHERE id = ?');
    });

    it('should allow binding parameters', () => {
      const client = new D1Client(mockDb);
      const stmt = client.prepare('SELECT * FROM users WHERE id = ?');
      const bound = stmt.bind('user123');

      expect(bound).toBeDefined();
    });
  });

  describe('query execution', () => {
    it('should execute queries with first()', async () => {
      const mockResult = { id: 'user123', email: 'test@example.com' };
      const mockStmt = createMockStmt();
      vi.mocked(mockStmt.first).mockResolvedValue(mockResult);
      mockDb.prepare.mockReturnValue(mockStmt);

      const client = new D1Client(mockDb);
      const result = await client.prepare('SELECT * FROM users WHERE id = ?')
        .bind('user123')
        .first();

      expect(result).toEqual(mockResult);
    });

    it('should execute queries with all()', async () => {
      const mockResults = [
        { id: 'user1', email: 'test1@example.com' },
        { id: 'user2', email: 'test2@example.com' },
      ];
      const mockStmt = createMockStmt();
      vi.mocked(mockStmt.all).mockResolvedValue(mockResults);
      mockDb.prepare.mockReturnValue(mockStmt);

      const client = new D1Client(mockDb);
      const result = await client.prepare('SELECT * FROM users')
        .bind()
        .all();

      expect(result).toEqual(mockResults);
    });

    it('should execute write queries with run()', async () => {
      const mockResult = { success: true, changes: 1 };
      const mockStmt = createMockStmt();
      vi.mocked(mockStmt.run).mockResolvedValue(mockResult);
      mockDb.prepare.mockReturnValue(mockStmt);

      const client = new D1Client(mockDb);
      const result = await client.prepare('INSERT INTO users (email) VALUES (?)')
        .bind('test@example.com')
        .run();

      expect(result).toEqual(mockResult);
    });

    it('should handle query errors', async () => {
      const mockError = new Error('SQL error');
      const mockStmt = createMockStmt();
      vi.mocked(mockStmt.first).mockRejectedValue(mockError);
      mockDb.prepare.mockReturnValue(mockStmt);

      const client = new D1Client(mockDb);

      await expect(
        client.prepare('INVALID SQL').bind().first()
      ).rejects.toThrow('SQL error');
    });
  });

  describe('batch operations', () => {
    it('should execute batch statements', async () => {
      const mockResults = [
        { meta: { rows_written: 1 } },
        { meta: { rows_written: 1 } },
      ] as D1Result<any>[];
      (mockDb.batch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResults);

      const client = new D1Client(mockDb);
      const stmt1 = client.prepare('INSERT INTO users (email) VALUES (?)');
      const stmt2 = client.prepare('INSERT INTO profiles (user_id) VALUES (?)');
      const result = await client['db'].batch([stmt1, stmt2]);

      expect(result).toEqual(mockResults);
    });
  });

  describe('utility methods', () => {
    it('should unwrap to underlying D1Database', () => {
      const client = new D1Client(mockDb);
      expect(client.unwrap()).toBe(mockDb);
    });

    it('should use from() query builder', () => {
      const client = new D1Client(mockDb);
      const query = client.from('users');

      expect(query).toBeDefined();
    });
  });
});
