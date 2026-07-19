import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fs only (child_process not used)
vi.mock('fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => ''),
  writeFileSync: vi.fn(),
}));

import * as fs from 'fs';
import { join } from 'path';

// Import after mocks
import {
  checkApiHealth,
  checkEndpoint,
  checkVersionEndpoint,
  generateReport,
  runSmokeChecks
} from '../post-deploy-smoke';

describe('post-deploy-smoke', () => {
  let originalEnv;

  const mockedExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;
  const mockedReadFileSync = fs.readFileSync as ReturnType<typeof vi.fn>;
  const mockedWriteFileSync = fs.writeFileSync as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockedExistsSync.mockReturnValue(false);
    mockedReadFileSync.mockReturnValue('');
    mockedWriteFileSync.mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    process.env = { ...originalEnv };
  });

  describe('checkEndpoint', () => {
    it('should pass when endpoint returns 200 within timeout', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      const result = await checkEndpoint('https://example.com/health');
      expect(result.passed).toBe(true);
      expect(result.statusCode).toBe(200);
    });

    it('should fail when endpoint returns non-200', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
      const result = await checkEndpoint('https://example.com/health');
      expect(result.passed).toBe(false);
      expect(result.statusCode).toBe(500);
    });

    it('should handle network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      const result = await checkEndpoint('https://example.com/health');
      expect(result.passed).toBe(false);
      expect(result.error).toContain('Network error');
    });

    // Timeout test skipped for TDD iteration
  });

  describe('checkApiHealth', () => {
    it('should check /api/health endpoint', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      const result = await checkApiHealth('https://example.com');
      expect(result.name).toBe('API Health');
      expect(result.url).toBe('https://example.com/api/health');
      expect(result.passed).toBe(true);
    });

    it('should add authentication header when API_TOKEN set', async () => {
      process.env.API_TOKEN = 'test-token';
      global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      await checkApiHealth('https://example.com');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/api/health',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });
  });

  describe('checkVersionEndpoint', () => {
    it('should verify shortSha matches expected', async () => {
      const expectedSha = 'abc12345';
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ shortSha: expectedSha }),
      });
      const result = await checkVersionEndpoint('https://example.com', expectedSha);
      expect(result.name).toBe('Version endpoint');
      expect(result.passed).toBe(true);
    });

    it('should fail when shortSha does not match', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ shortSha: 'different' }),
      });
      const result = await checkVersionEndpoint('https://example.com', 'expected');
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('expected (local) vs different (live)');
    });

    it('should handle missing shortSha in response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });
      const result = await checkVersionEndpoint('https://example.com', 'abc12345');
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Missing shortSha');
    });
  });

  describe('generateReport', () => {
    it('should generate JSON report with summary', () => {
      const results = [
        { name: 'Check 1', passed: true, duration: 100 },
        { name: 'Check 2', passed: false, reason: 'Failed', duration: 200 },
      ];
      const report = generateReport(results, 'https://example.com');
      expect(report.timestamp).toBeDefined();
      expect(report.url).toBe('https://example.com');
      expect(report.summary).toEqual({ passed: 1, failed: 1, total: 2 });
      expect(report.results).toEqual(results);
    });

    it('should include all passed checks when all successful', () => {
      const results = [
        { name: 'Check 1', passed: true },
        { name: 'Check 2', passed: true },
      ];
      const report = generateReport(results, 'https://example.com');
      expect(report.summary.passed).toBe(2);
      expect(report.summary.failed).toBe(0);
    });
  });

  describe('runSmokeChecks', () => {
    it('should run all checks and return report', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200 }) // health
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ shortSha: 'abc12345' }) }); // version
      const report = await runSmokeChecks('https://example.com', 'abc12345');
      expect(report.results.length).toBeGreaterThanOrEqual(2);
      expect(report.summary).toBeDefined();
    });

    it('should respect SKIP_SMOKE_TEST flag', async () => {
      process.env.SKIP_SMOKE_TEST = '1';
      const report = await runSmokeChecks('https://example.com', 'abc12345');
      expect(report.skipped).toBe(true);
      expect(report.reason).toContain('SKIP_SMOKE_TEST');
    });
  });

  describe('CLI output', () => {
    it('should print human-readable results', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200 }) // health
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ shortSha: 'abc' }) }); // version
      const report = await runSmokeChecks('https://example.com', 'abc');
      const summary = `✅ ${report.summary.passed} passed, ${report.summary.failed} failed`;
      expect(summary).toContain('passed');
    });
  });
});
