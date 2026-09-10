import { describe, it, expect } from 'vitest';
import {
  maskTenantId,
  sanitizeText,
  classifyErrorToCategory,
  generateDiagnosticBundle,
} from '../diagnostic-bundle-generator';

describe('diagnostic-bundle-generator', () => {
  describe('maskTenantId', () => {
    it('masks tenant ID safely without leaking full string', () => {
      const masked = maskTenantId('user_1234567890abcdef');
      expect(masked).toBe('usr_***abcdef');
      expect(masked).not.toContain('1234567890');
    });

    it('handles short or empty user ID safely', () => {
      expect(maskTenantId('')).toBe('usr_anon');
      expect(maskTenantId('abc')).toBe('usr_***abc');
    });
  });

  describe('sanitizeText', () => {
    it('purges OpenAI and provider API keys', () => {
      const raw = 'Failed at key sk-proj-1234567890abcdef12345678 in header';
      const clean = sanitizeText(raw);
      expect(clean).not.toContain('sk-proj-1234567890abcdef12345678');
      expect(clean).toContain('[REDACTED]');
    });

    it('purges Bearer tokens and JWTs', () => {
      const raw = 'Authorization: Bearer secret_token_xyz123';
      const clean = sanitizeText(raw);
      expect(clean).not.toContain('secret_token_xyz123');
      expect(clean).toContain('[REDACTED]');
    });

    it('purges database connection strings', () => {
      const raw = 'Connection error: postgres://postgres:supersecret@db.host.internal:5432/sophia';
      const clean = sanitizeText(raw);
      expect(clean).not.toContain('postgres://');
      expect(clean).not.toContain('supersecret');
      expect(clean).toContain('[REDACTED]');
    });

    it('purges email addresses from error traces', () => {
      const raw = 'User ceo@mycompany.com failed to authenticate';
      const clean = sanitizeText(raw);
      expect(clean).not.toContain('ceo@mycompany.com');
      expect(clean).toContain('[REDACTED]');
    });
  });

  describe('classifyErrorToCategory', () => {
    it('identifies key expiry or invalid auth', () => {
      expect(classifyErrorToCategory('401 Unauthorized API key')).toBe('KEY_EXPIRED_OR_INVALID');
      expect(classifyErrorToCategory('invalid_api_key supplied')).toBe('KEY_EXPIRED_OR_INVALID');
    });

    it('identifies provider rate limits', () => {
      expect(classifyErrorToCategory('HTTP 429 Too Many Requests')).toBe('PROVIDER_RATE_LIMIT');
      expect(classifyErrorToCategory('rate limit exceeded')).toBe('PROVIDER_RATE_LIMIT');
    });

    it('identifies quota exhaustion', () => {
      expect(classifyErrorToCategory('402 Payment Required: balance depleted')).toBe('QUOTA_EXHAUSTED');
    });

    it('identifies network timeouts', () => {
      expect(classifyErrorToCategory('request timeout after 5000ms')).toBe('NETWORK_TIMEOUT');
    });

    it('identifies asset validation failures', () => {
      expect(classifyErrorToCategory('nsfw prompt safety filter triggered')).toBe('ASSET_VALIDATION_FAILED');
    });
  });

  describe('generateDiagnosticBundle', () => {
    it('creates compliant, sanitized report bundle', () => {
      const bundle = generateDiagnosticBundle({
        userId: 'user_live_corp_99998888',
        appVersion: '0.1.5',
        commitSha: 'c35840f4abcdef123',
        providers: [
          { name: 'fal.ai', configured: true, status: 'ACTIVE' },
          { name: 'ElevenLabs', configured: false, status: 'NOT_CONFIGURED' },
        ],
        recentErrors: [
          'Error 429 rate limit exceeded for fal.ai',
          'sk-secret-token-key-failed',
        ],
        systemHealth: 'READY',
      });

      expect(bundle.reportId).toMatch(/^diag_/);
      expect(bundle.app.name).toBe('Sophia AI Factory');
      expect(bundle.app.commitSha).toBe('c35840f4');
      expect(bundle.tenant.maskedId).toBe('usr_***998888');
      expect(bundle.verification.isSanitized).toBe(true);
      expect(bundle.verification.excludedElements).toContain('api_keys');
      expect(bundle.verification.excludedElements).toContain('passwords');
      expect(bundle.diagnostics.recentErrorCategories).toContain('PROVIDER_RATE_LIMIT');
      expect(bundle.diagnostics.recentErrorCategories).toContain('KEY_EXPIRED_OR_INVALID');
      expect(JSON.stringify(bundle)).not.toContain('sk-secret-token');
      expect(JSON.stringify(bundle)).not.toContain('user_live_corp_99998888');
    });
  });
});
