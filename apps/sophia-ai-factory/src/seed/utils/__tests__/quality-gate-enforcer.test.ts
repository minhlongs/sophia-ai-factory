/**
 * Tests for quality gate enforcer (circuit breaker compliance scanner).
 * Verifies detection of unwired external HTTP calls.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { scanForUnwiredExternalCalls, printReport } from '../quality-gate-enforcer';
import type { UnwiredReport } from '../quality-gate-enforcer';

// Hoisted mocks must be declared before vi.mock calls
const { mockReaddirSync, mockReadFileSync } = vi.hoisted(() => ({
  mockReaddirSync: vi.fn(),
  mockReadFileSync: vi.fn(),
}));

// Mock logger
vi.mock('../index', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock fs operations
vi.mock('fs', () => ({
  readdirSync: mockReaddirSync,
  readFileSync: mockReadFileSync,
}));

/** Helper to create a mock Dirent array */
function createDirents(entries: Array<{ name: string; isDir: boolean }>): Array<{ name: string; isFile: () => boolean; isDirectory: () => boolean }> {
  return entries.map(({ name, isDir }) => ({
    name,
    isFile: () => !isDir,
    isDirectory: () => isDir,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isSymbolicLink: () => false,
    isFIFO: () => false,
    isSocket: () => false,
    parentPath: '',
    path: '',
  }));
}

describe('quality-gate-enforcer', () => {
  const TEST_DIR = '/test/src';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('scanForUnwiredExternalCalls', () => {
    it('returns empty unwired list for directory with no files', () => {
      mockReaddirSync.mockReturnValue([]);

      const report = scanForUnwiredExternalCalls(TEST_DIR);

      expect(report.total).toBe(0);
      expect(report.unwired).toHaveLength(0);
      expect(report.wired).toBe(0);
    });

    it('returns empty unwired list for directory with no TypeScript files', () => {
      mockReaddirSync.mockReturnValue(createDirents([
        { name: 'readme.md', isDir: false },
      ]));

      const report = scanForUnwiredExternalCalls(TEST_DIR);

      expect(report.total).toBe(0);
      expect(report.unwired).toHaveLength(0);
    });

    it('detects unwired fetch call to external URL', () => {
      const fileContent = `
        export async function fetchData() {
          const response = await fetch('https://api.example.com/data');
          return response.json();
        }
      `;

      mockReaddirSync.mockReturnValue(createDirents([
        { name: 'test.ts', isDir: false },
      ]));
      mockReadFileSync.mockReturnValue(fileContent);

      const report = scanForUnwiredExternalCalls(TEST_DIR);

      expect(report.total).toBe(1);
      expect(report.unwired.length).toBeGreaterThanOrEqual(1);
      if (report.unwired.length > 0) {
        expect(report.unwired[0].file).toBe('test.ts');
        expect(report.unwired[0].line).toBe(3);
        expect(report.unwired[0].url).toBe('https://api.example.com/data');
        expect(report.unwired[0].hasTryCatch).toBe(false);
      }
    });

    it('ignores internal URLs (localhost, 127.0.0.1)', () => {
      const fileContent = `
        export async function fetchLocal() {
          const response = await fetch('http://localhost:3000/api/test');
          const res2 = await fetch('http://127.0.0.1:8080/health');
          const res3 = await fetch('/api/internal');
          return { response, res2, res3 };
        }
      `;

      mockReaddirSync.mockReturnValue(createDirents([
        { name: 'local.ts', isDir: false },
      ]));
      mockReadFileSync.mockReturnValue(fileContent);

      const report = scanForUnwiredExternalCalls(TEST_DIR);

      expect(report.total).toBe(1);
      expect(report.unwired).toHaveLength(0);
    });

    it('marks file as wired when imports circuit breaker', () => {
      const fileContent = `
        import { recordFailure, recordSuccess } from '@/seed/security/circuit-breaker';

        export async function fetchData() {
          const response = await fetch('https://api.openrouter.com/chat');
          return response.json();
        }
      `;

      mockReaddirSync.mockReturnValue(createDirents([
        { name: 'wired.ts', isDir: false },
      ]));
      mockReadFileSync.mockReturnValue(fileContent);

      const report = scanForUnwiredExternalCalls(TEST_DIR);

      expect(report.total).toBe(1);
      expect(report.unwired).toHaveLength(0);
      expect(report.wired).toBe(1);
    });

    it('detects hasTryCatch correctly', () => {
      const fileContent = `
        export async function fetchData() {
          try {
            const response = await fetch('https://api.example.com/data');
            return response.json();
          } catch (error) {
            throw error;
          }
        }
      `;

      mockReaddirSync.mockReturnValue(createDirents([
        { name: 'trycatch.ts', isDir: false },
      ]));
      mockReadFileSync.mockReturnValue(fileContent);

      const report = scanForUnwiredExternalCalls(TEST_DIR);

      expect(report.unwired).toHaveLength(1);
      expect(report.unwired[0].hasTryCatch).toBe(true);
    });

    it('skips test files and node_modules', () => {
      mockReaddirSync
        .mockReturnValueOnce(createDirents([
          { name: 'app.ts', isDir: false },
          { name: 'app.test.ts', isDir: false },
          { name: 'node_modules', isDir: true },
          { name: '__tests__', isDir: true },
        ]));

      mockReadFileSync.mockReturnValue(`
        export const fetch = async () => ({});
      `);

      const report = scanForUnwiredExternalCalls(TEST_DIR);

      expect(report.total).toBe(1);
    });

    it('handles multiple fetch calls in same file', () => {
      const fileContent = `
        export async function multiFetch() {
          const r1 = await fetch('https://api.service1.com/a');
          const r2 = await fetch('https://api.service2.com/b');
          const r3 = await fetch('https://api.service3.com/c');
          return { r1, r2, r3 };
        }
      `;

      mockReaddirSync.mockReturnValue(createDirents([
        { name: 'multi.ts', isDir: false },
      ]));
      mockReadFileSync.mockReturnValue(fileContent);

      const report = scanForUnwiredExternalCalls(TEST_DIR);

      expect(report.unwired).toHaveLength(3);
      expect(report.unwired[0].url).toBe('https://api.service1.com/a');
      expect(report.unwired[1].url).toBe('https://api.service2.com/b');
      expect(report.unwired[2].url).toBe('https://api.service3.com/c');
    });

    it('handles nested directories', () => {
      const nestedFiles = `
        export async function nestedFetch() {
          const response = await fetch('https://api.deep.com/data');
          return response.json();
        }
      `;

      mockReaddirSync
        .mockReturnValueOnce(createDirents([
          { name: 'subdir', isDir: true },
          { name: 'root.ts', isDir: false },
        ]))
        .mockReturnValueOnce(createDirents([
          { name: 'nested.ts', isDir: false },
        ]));

      mockReadFileSync.mockReturnValue(nestedFiles);

      const report = scanForUnwiredExternalCalls(TEST_DIR);

      expect(report.total).toBe(2);
      expect(report.unwired).toHaveLength(2);
    });
  });

  describe('printReport', () => {
    it('prints success message when no violations', () => {
      const report: UnwiredReport = {
        total: 10,
        unwired: [],
        wired: 5,
      };

      // Should not throw
      expect(() => printReport(report)).not.toThrow();
    });

    it('prints violations when found', () => {
      const report: UnwiredReport = {
        total: 10,
        unwired: [
          { file: 'test.ts', line: 10, url: 'https://api.example.com', hasTryCatch: false },
          { file: 'service.ts', line: 25, url: 'https://api.other.com', hasTryCatch: true },
        ],
        wired: 3,
      };

      // Should not throw
      expect(() => printReport(report)).not.toThrow();
    });
  });
});
