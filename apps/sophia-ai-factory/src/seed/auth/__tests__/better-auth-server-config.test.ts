import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  CANONICAL_TRUSTED_ORIGINS,
  resolveBaseURL,
  resolveTrustedOrigins,
  sanitizeAndResolveUserName,
  handleUserCreateBefore,
  resetAuthForTesting,
  getAuth,
} from '@/seed/auth/better-auth-server';
import { getD1 } from '@/seed/db/client';
import { betterAuth } from 'better-auth';

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
  createServerClient: vi.fn(),
}));

vi.mock('better-auth', () => ({
  betterAuth: vi.fn((opts: Record<string, unknown>) => ({
    opts,
    api: {},
  })),
}));

vi.mock('better-auth/plugins', () => ({
  magicLink: vi.fn(() => ({ id: 'magic-link' })),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/seed/auth/founder-bootstrap', () => ({
  bootstrapFounderIfConfigured: vi.fn(),
}));

vi.mock('@/seed/security/password-hash', () => ({
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock('@/seed/auth/signup-bonus', () => ({
  grantSignupBonusCredits: vi.fn(),
}));

vi.mock('@/seed/auth/revoke-user-sessions', () => ({
  revokeAllUserSessions: vi.fn(),
}));

describe('Better Auth Server Configuration & Hardening', () => {
  const originalGlobalEnv = (globalThis as unknown as { __env__?: Record<string, unknown> }).__env__;

  beforeEach(() => {
    vi.clearAllMocks();
    resetAuthForTesting();
    delete (globalThis as unknown as { __env__?: Record<string, unknown> }).__env__;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    if (originalGlobalEnv !== undefined) {
      (globalThis as unknown as { __env__?: Record<string, unknown> }).__env__ = originalGlobalEnv;
    } else {
      delete (globalThis as unknown as { __env__?: Record<string, unknown> }).__env__;
    }
  });

  describe('R1: Canonical Trusted Origins & Base URL Resolution', () => {
    it('defines CANONICAL_TRUSTED_ORIGINS containing production domain, worker dev subdomain, and localhost', () => {
      expect(CANONICAL_TRUSTED_ORIGINS).toContain('https://sophia.agencyos.network');
      expect(CANONICAL_TRUSTED_ORIGINS).toContain('https://sophia-ai-factory.agencyos-openclaw.workers.dev');
      expect(CANONICAL_TRUSTED_ORIGINS).toContain('https://sophia-ai-factory-staging.agencyos-openclaw.workers.dev');
      expect(CANONICAL_TRUSTED_ORIGINS).toContain('http://localhost:3000');
      expect(CANONICAL_TRUSTED_ORIGINS).toContain('http://localhost:8787');
      expect(CANONICAL_TRUSTED_ORIGINS).toContain('http://127.0.0.1:3000');
      expect(CANONICAL_TRUSTED_ORIGINS).toContain('http://127.0.0.1:8787');
    });

    it('resolveTrustedOrigins unconditionally includes all canonical origins regardless of environment', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const origins = resolveTrustedOrigins();
      expect(origins).toContain('https://sophia.agencyos.network');
      expect(origins).toContain('https://sophia-ai-factory.agencyos-openclaw.workers.dev');
      expect(origins).toContain('http://localhost:3000');
      expect(origins).toContain('http://127.0.0.1:3000');
    });

    it('resolveTrustedOrigins merges and deduplicates dynamic origins from environment variables', () => {
      vi.stubEnv('TRUSTED_ORIGINS', 'https://preview.agencyos.network, https://sophia.agencyos.network');
      vi.stubEnv('BETTER_AUTH_TRUSTED_ORIGINS', 'https://custom-partner.com/');
      const origins = resolveTrustedOrigins();

      expect(origins).toContain('https://preview.agencyos.network');
      expect(origins).toContain('https://custom-partner.com');
      // Verify no duplicates
      const uniqueCount = new Set(origins).size;
      expect(origins.length).toBe(uniqueCount);
    });

    it('resolveBaseURL in production refuses localhost pollution and falls back to canonical production URL', () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('BETTER_AUTH_URL', 'http://localhost:3000');
      const baseURL = resolveBaseURL();
      expect(baseURL).toBe('https://sophia.agencyos.network');
    });

    it('resolveBaseURL in production accepts valid external URL', () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('BETTER_AUTH_URL', 'https://custom-domain.agencyos.network');
      const baseURL = resolveBaseURL();
      expect(baseURL).toBe('https://custom-domain.agencyos.network');
    });

    it('resolveBaseURL in development allows localhost', () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('BETTER_AUTH_URL', '');
      vi.stubEnv('APP_URL', '');
      const baseURL = resolveBaseURL();
      expect(baseURL).toBe('http://localhost:3000');
    });

    it('resolveBaseURL respects Cloudflare Workers globalThis.__env__ bindings', () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('BETTER_AUTH_URL', '');
      vi.stubEnv('APP_URL', '');
      (globalThis as unknown as { __env__?: Record<string, unknown> }).__env__ = {
        BETTER_AUTH_URL: 'https://edge-worker.agencyos.network',
      };
      const baseURL = resolveBaseURL();
      expect(baseURL).toBe('https://edge-worker.agencyos.network');
    });
  });

  describe('R2: wrangler.toml Environment Variable Parity', () => {
    it('verifies wrangler.toml has BETTER_AUTH_URL and APP_URL configured in [vars]', () => {
      const possiblePaths = [
        path.resolve(__dirname, '../../../../wrangler.toml'),
        path.resolve(process.cwd(), 'wrangler.toml'),
        path.resolve(process.cwd(), 'apps/sophia-ai-factory/wrangler.toml'),
      ];

      const wranglerPath = possiblePaths.find((p) => fs.existsSync(p));
      expect(wranglerPath).toBeDefined();

      const content = fs.readFileSync(wranglerPath!, 'utf-8');
      const varsSectionIndex = content.indexOf('[vars]');
      expect(varsSectionIndex).toBeGreaterThan(-1);

      const varsBlock = content.slice(varsSectionIndex);
      expect(varsBlock).toMatch(/BETTER_AUTH_URL\s*=\s*"https:\/\/sophia\.agencyos\.network"/);
      expect(varsBlock).toMatch(/APP_URL\s*=\s*"https:\/\/sophia\.agencyos\.network"/);
    });
  });

  describe('R3: Defensive User Creation & Magic Link Name Fallback', () => {
    it('sanitizeAndResolveUserName falls back to email prefix when name is undefined', () => {
      const name = sanitizeAndResolveUserName(undefined, 'alice.smith@agencyos.network');
      expect(name).toBe('alice.smith');
    });

    it('sanitizeAndResolveUserName falls back to email prefix when name is empty string', () => {
      const name = sanitizeAndResolveUserName('', 'bob-builder@example.com');
      expect(name).toBe('bob-builder');
    });

    it('sanitizeAndResolveUserName falls back to email prefix when name is whitespace', () => {
      const name = sanitizeAndResolveUserName('   \t\n  ', 'charlie@domain.org');
      expect(name).toBe('charlie');
    });

    it('sanitizeAndResolveUserName preserves clean provided name', () => {
      const name = sanitizeAndResolveUserName('Acme Corporation', 'founder@acme.com');
      expect(name).toBe('Acme Corporation');
    });

    it('sanitizeAndResolveUserName sanitizes control characters from provided name', () => {
      const name = sanitizeAndResolveUserName('Evil\u0000Company\u001fInc\u007f', 'ceo@evil.com');
      expect(name).toBe('EvilCompanyInc');
    });

    it('sanitizeAndResolveUserName sanitizes control characters from email prefix fallback', () => {
      const name = sanitizeAndResolveUserName(undefined, 'bad\u0000name\u0007@evil.com');
      expect(name).toBe('badname');
    });

    it('sanitizeAndResolveUserName truncates excessively long names to 100 characters', () => {
      const longName = 'A'.repeat(150);
      const name = sanitizeAndResolveUserName(longName, 'long@domain.com');
      expect(name.length).toBe(100);
      expect(name).toBe('A'.repeat(100));
    });

    it('sanitizeAndResolveUserName falls back to "user" when both name and email are invalid', () => {
      const name = sanitizeAndResolveUserName('', '');
      expect(name).toBe('user');
    });

    it('handleUserCreateBefore hook populates name with email prefix without throwing Error', async () => {
      const user: { id: string; email: string; name?: string } = {
        id: 'usr_123',
        email: 'magic-user@agencyos.network',
        name: undefined,
      };

      const result = await handleUserCreateBefore(user);
      expect(result).toHaveProperty('data');
      expect(result.data.name).toBe('magic-user');
      expect(result.data.email).toBe('magic-user@agencyos.network');
      expect(result.data.id).toBe('usr_123');
    });

    it('handleUserCreateBefore hook handles empty name string gracefully', async () => {
      const user: { id: string; email: string; name?: string } = {
        id: 'usr_456',
        email: 'newbie@company.co',
        name: '',
      };

      const result = await handleUserCreateBefore(user);
      expect(result.data.name).toBe('newbie');
    });
  });

  describe('Integration with getAuth()', () => {
    it('calls betterAuth with trustedOrigins containing production domain and localhost', async () => {
      const mockD1 = {
        prepare: vi.fn(),
        batch: vi.fn(),
        exec: vi.fn(),
        dump: vi.fn(),
      };
      type D1Type = Awaited<ReturnType<typeof getD1>>;
      vi.mocked(getD1).mockResolvedValue(mockD1 as unknown as D1Type);
      vi.stubEnv('BETTER_AUTH_SECRET', 'test-secret-at-least-32-chars-long-12345');
      vi.stubEnv('NODE_ENV', 'production');

      await getAuth();

      expect(betterAuth).toHaveBeenCalledTimes(1);
      const passedOptions = vi.mocked(betterAuth).mock.calls[0][0] as {
        trustedOrigins: string[];
        baseURL: string;
        databaseHooks?: {
          user?: {
            create?: {
              before?: (user: { name?: unknown; email?: unknown; [key: string]: unknown }) => Promise<{ data: { name: string } }>;
            };
          };
        };
      };

      expect(passedOptions.trustedOrigins).toContain('https://sophia.agencyos.network');
      expect(passedOptions.trustedOrigins).toContain('https://sophia-ai-factory.agencyos-openclaw.workers.dev');
      expect(passedOptions.trustedOrigins).toContain('http://localhost:3000');
      expect(passedOptions.baseURL).toBe('https://sophia.agencyos.network');

      // Test before hook passed to betterAuth
      const beforeHook = passedOptions.databaseHooks?.user?.create?.before;
      expect(beforeHook).toBeDefined();

      const hookResult = await beforeHook!({
        email: 'integration@agencyos.network',
        name: '',
      });
      expect(hookResult.data.name).toBe('integration');
    });
  });
});
