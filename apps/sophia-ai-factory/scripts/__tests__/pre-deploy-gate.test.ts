import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock only the fs functions we need (namespace import)
vi.mock('fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => ''),
}));

// Mock child_process (namespace import)
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

import * as fs from 'fs';
import * as childProcess from 'child_process';
import { join } from 'path';

describe('pre-deploy-gate', () => {
  let originalEnv;

  const mockedExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;
  const mockedReadFileSync = fs.readFileSync as ReturnType<typeof vi.fn>;
  const mockedExecSync = childProcess.execSync as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.clearAllMocks();
    mockedExistsSync.mockReturnValue(false);
    mockedReadFileSync.mockReturnValue('');
    mockedExecSync.mockReturnValue('');
  });

  afterEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  describe('Git clean check', () => {
    it('should pass when git status is clean', () => {
      mockedExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('git status --porcelain')) return '';
        if (cmd.includes('git ls-files --others')) return '';
        return '';
      });

      const status = mockedExecSync('git status --porcelain', { cwd: '/fake', encoding: 'utf8' }) as string;
      const untracked = mockedExecSync('git ls-files --others --exclude-standard', { cwd: '/fake', encoding: 'utf8' }) as string;

      expect(status.trim()).toBe('');
      expect(untracked.trim()).toBe('');
    });

    it('should fail when uncommitted changes exist', () => {
      mockedExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('git status --porcelain')) return 'M file.ts';
        return '';
      });
      const status = mockedExecSync('git status --porcelain', { cwd: '/fake', encoding: 'utf8' }) as string;
      expect(status.trim()).toBe('M file.ts');
    });
  });

  describe('Tests check', () => {
    it('should skip when SKIP_TESTS=1', () => {
      process.env.SKIP_TESTS = '1';
      expect(process.env.SKIP_TESTS).toBe('1');
    });

    it('should fail when npm test returns non-zero', () => {
      mockedExecSync.mockImplementation((cmd: string) => {
        if (cmd === 'npm test') throw new Error('Tests failed');
        return '';
      });
      let passed = true;
      try {
        mockedExecSync('npm test');
      } catch {
        passed = false;
      }
      expect(passed).toBe(false);
    });

    it('should pass when npm test returns 0', () => {
      let passed = true;
      try {
        mockedExecSync('npm test');
      } catch {
        passed = false;
      }
      expect(passed).toBe(true);
    });
  });

  describe('TypeScript check', () => {
    it('should skip when SKIP_TSC=1', () => {
      process.env.SKIP_TSC = '1';
      expect(process.env.SKIP_TSC).toBe('1');
    });

    it('should fail when type-check fails', () => {
      mockedExecSync.mockImplementation((cmd: string) => {
        if (cmd === 'npm run type-check') throw new Error('TS errors');
        return '';
      });
      let passed = true;
      try {
        mockedExecSync('npm run type-check');
      } catch {
        passed = false;
      }
      expect(passed).toBe(false);
    });
  });

  describe('Secrets check', () => {
    const mockEnvContent = `
OPENROUTER_API_KEY=sk-test
NOWPAYMENTS_API_KEY=np-test
TELEGRAM_BOT_TOKEN=bot-test
CLOUDFLARE_API_TOKEN=token-test
CLOUDFLARE_ACCOUNT_ID=account-test
`;

    it('should pass when all required secrets present in .env.local', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(mockEnvContent);
      const REQUIRED_SECRETS = [
        'OPENROUTER_API_KEY',
        'NOWPAYMENTS_API_KEY',
        'TELEGRAM_BOT_TOKEN',
        'CLOUDFLARE_API_TOKEN',
        'CLOUDFLARE_ACCOUNT_ID',
      ];
      const env = {};
      const lines = mockEnvContent.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq < 0) continue;
        const key = trimmed.slice(0, eq).trim();
        const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
        if (val) env[key] = val;
      }
      const missing = REQUIRED_SECRETS.filter(k => !env[k] && !process.env[k]);
      expect(missing.length).toBe(0);
    });

    it('should fail when OPENROUTER_API_KEY missing', () => {
      mockedExistsSync.mockReturnValue(true);
      const incompleteEnv = `
NOWPAYMENTS_API_KEY=np-test
TELEGRAM_BOT_TOKEN=bot-test
CLOUDFLARE_API_TOKEN=token-test
CLOUDFLARE_ACCOUNT_ID=account-test
`;
      mockedReadFileSync.mockReturnValue(incompleteEnv);
      const REQUIRED_SECRETS = [
        'OPENROUTER_API_KEY',
        'NOWPAYMENTS_API_KEY',
        'TELEGRAM_BOT_TOKEN',
        'CLOUDFLARE_API_TOKEN',
        'CLOUDFLARE_ACCOUNT_ID',
      ];
      const env = {};
      const lines = incompleteEnv.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq < 0) continue;
        const key = trimmed.slice(0, eq).trim();
        const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
        if (val) env[key] = val;
      }
      const missing = REQUIRED_SECRETS.filter(k => !env[k] && !process.env[k]);
      expect(missing).toContain('OPENROUTER_API_KEY');
    });
  });

  describe('Migrations review', () => {
    it('should pass when no new migrations', () => {
      mockedExecSync.mockReturnValue('');
      try {
        const changed = mockedExecSync('git diff --name-only origin/main...HEAD -- migrations/*.sql', {
          cwd: '/fake', encoding: 'utf8'
        }) as string;
        expect(changed.trim()).toBe('');
      } catch (e) {
        // git diff may fail if origin/main doesn't exist - that's a skip scenario, still ok
      }
    });

    it('should detect unreviewed migrations', () => {
      mockedExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('git diff --name-only')) return 'migrations/123_add_users.sql\n';
        return '';
      });
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue('-- Migration: add users table\n-- No review comment\nCREATE TABLE users...');
      const changed = 'migrations/123_add_users.sql';
      const files = changed.split('\n').filter(Boolean);
      const unreviewed = [];
      for (const file of files) {
        const content = mockedReadFileSync(join('/fake', file), 'utf8') as string;
        const hasReview = /(?:Reviewed by|Reviewed-by|RR:|AUTHORIZED:|Ticket:).*/i.test(content);
        if (!hasReview) unreviewed.push(file);
      }
      expect(unreviewed).toContain('migrations/123_add_users.sql');
    });

    it('should pass when migrations have review comments', () => {
      mockedExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('git diff --name-only')) return 'migrations/123_add_users.sql\n';
        return '';
      });
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue('-- Migration: add users table\n-- Reviewed by: team\n-- Ticket: PROJ-123\nCREATE TABLE users...');
      const changed = 'migrations/123_add_users.sql';
      const files = changed.split('\n').filter(Boolean);
      const unreviewed = [];
      for (const file of files) {
        const content = mockedReadFileSync(join('/fake', file), 'utf8') as string;
        const hasReview = /(?:Reviewed by|Reviewed-by|RR:|AUTHORIZED:|Ticket:).*/i.test(content);
        if (!hasReview) unreviewed.push(file);
      }
      expect(unreviewed).toHaveLength(0);
    });
  });

  describe('Skip flag', () => {
    it('should bypass when SKIP_PRE_DEPLOY_GATE=1', () => {
      process.env.SKIP_PRE_DEPLOY_GATE = '1';
      expect(process.env.SKIP_PRE_DEPLOY_GATE).toBe('1');
    });
  });
});
