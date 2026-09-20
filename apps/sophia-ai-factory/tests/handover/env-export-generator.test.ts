/**
 * Environment Variable Sanitizer & Customer Export Generator Test Suite
 * Tests: .env.example parsing, secret masking with length indicators, public config preservation, and missing key detection.
 *
 * @vitest
 */

import { describe, it, expect } from 'vitest';
import {
  PUBLIC_CONFIG_KEYS,
  MANDATORY_PRODUCTION_KEYS,
  isSensitiveKey,
  maskSecretValue,
  generateSanitizedEnvProduction,
} from '@/tree/handover/env-export-generator';

describe('Environment Variable Sanitizer & Customer Export Generator', () => {
  describe('isSensitiveKey', () => {
    it('classifies secret and key patterns as sensitive', () => {
      expect(isSensitiveKey('BETTER_AUTH_SECRET')).toBe(true);
      expect(isSensitiveKey('API_ENCRYPTION_KEY')).toBe(true);
      expect(isSensitiveKey('TELEGRAM_BOT_TOKEN')).toBe(true);
      expect(isSensitiveKey('DATABASE_PASSWORD')).toBe(true);
      expect(isSensitiveKey('SENTRY_DSN')).toBe(true);
      expect(isSensitiveKey('AUDIT_HASH_SALT')).toBe(true);
      expect(isSensitiveKey('BYOK_MASTER_KEY')).toBe(true);
      expect(isSensitiveKey('NOWPAYMENTS_API_KEY')).toBe(true);
      expect(isSensitiveKey('NOWPAYMENTS_IPN_SECRET')).toBe(true);
    });

    it('classifies public configuration keys as non-sensitive', () => {
      expect(isSensitiveKey('NEXT_PUBLIC_APP_URL')).toBe(false);
      expect(isSensitiveKey('BETTER_AUTH_URL')).toBe(false);
      expect(isSensitiveKey('NEXT_PUBLIC_DISTRIBUTE_ENABLED')).toBe(false);
      expect(isSensitiveKey('IS_CONFIGURED')).toBe(false);
      expect(isSensitiveKey('FEATURE_PAYOS')).toBe(false);
      expect(isSensitiveKey('RESEND_FROM_EMAIL')).toBe(false);
      expect(isSensitiveKey('SUPPORT_EMAIL')).toBe(false);
      expect(isSensitiveKey('HONEYCOMB_DATASET')).toBe(false);
      expect(isSensitiveKey('OTEL_SERVICE_NAME')).toBe(false);
      expect(isSensitiveKey('R2_PUBLIC_HOSTNAME')).toBe(false);
    });

    it('is case-insensitive for sensitive key matching', () => {
      expect(isSensitiveKey('my_secret_token')).toBe(true);
      expect(isSensitiveKey('custom_api_key')).toBe(true);
      expect(isSensitiveKey('user_password')).toBe(true);
    });
  });

  describe('maskSecretValue', () => {
    it('returns [REDACTED_SECRET:len=0] or appropriate len=0 marker when value is missing or empty', () => {
      expect(maskSecretValue('CRON_SECRET', undefined)).toBe('[REDACTED_SECRET:len=0]');
      expect(maskSecretValue('CRON_SECRET', '')).toBe('[REDACTED_SECRET:len=0]');
      expect(maskSecretValue('API_KEY', '')).toBe('[REDACTED_KEY:len=0]');
      expect(maskSecretValue('TELEGRAM_TOKEN', '')).toBe('[REDACTED_TOKEN:len=0]');
    });

    it('masks with exact length indicators for API keys', () => {
      const apiKey32 = '12345678901234567890123456789012';
      expect(maskSecretValue('NOWPAYMENTS_API_KEY', apiKey32)).toBe('[REDACTED_API_KEY:len=32]');
    });

    it('masks master encryption keys with REDACTED_KEY marker', () => {
      const masterKey44 = 'U29tZUJhc2U2NEVuY29kZWRNYXN0ZXJLZXlWYWx1ZTEy';
      expect(maskSecretValue('API_ENCRYPTION_KEY', masterKey44)).toBe('[REDACTED_KEY:len=44]');
      expect(maskSecretValue('BYOK_MASTER_KEY', masterKey44)).toBe('[REDACTED_KEY:len=44]');
    });

    it('masks tokens with REDACTED_TOKEN marker', () => {
      const token = 'bot123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
      expect(maskSecretValue('TELEGRAM_BOT_TOKEN', token)).toBe(`[REDACTED_TOKEN:len=${token.length}]`);
    });

    it('masks generic secrets with REDACTED_SECRET marker', () => {
      const secret = 'super-long-better-auth-secret-value-32chars';
      expect(maskSecretValue('BETTER_AUTH_SECRET', secret)).toBe(`[REDACTED_SECRET:len=${secret.length}]`);
    });
  });

  describe('generateSanitizedEnvProduction', () => {
    const sampleEnvTemplate = `
# ─── Core Platform ────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=https://sophia.agencyos.network
BETTER_AUTH_URL=https://sophia.agencyos.network
IS_CONFIGURED=true

# ─── Better Auth & Security ───────────────────────────────────────────────────
BETTER_AUTH_SECRET=

# ─── Payments (NOWPayments) ───────────────────────────────────────────────────
NOWPAYMENTS_API_KEY=
NOWPAYMENTS_IPN_SECRET=
FEATURE_PAYOS=0

# ─── Email / Notifications ───────────────────────────────────────────────────
RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@sophia.agencyos.network
SUPPORT_EMAIL=support@sophia.agencyos.network
TELEGRAM_BOT_TOKEN=

# ─── Master Encryption Keys ───────────────────────────────────────────────────
API_ENCRYPTION_KEY=
BYOK_MASTER_KEY=
CRON_SECRET=
`.trim();

    it('preserves public configuration values while masking secrets', () => {
      const currentEnv = {
        NEXT_PUBLIC_APP_URL: 'https://my-agency.agencyos.network',
        BETTER_AUTH_SECRET: 'secret_12345678901234567890123456789012',
        NOWPAYMENTS_API_KEY: 'nowpay_api_key_sample_32chars_long',
        NOWPAYMENTS_IPN_SECRET: 'ipn_secret_value_24chars',
        RESEND_API_KEY: 're_123456789_resend_api_key',
        API_ENCRYPTION_KEY: 'encryption_master_key_32_characters_here',
        BYOK_MASTER_KEY: 'byok_master_key_32_characters_here_now',
        CRON_SECRET: 'cron_super_secret_32_characters_long',
        TELEGRAM_BOT_TOKEN: '1234567890:mock_token_for_testing',
      };

      const result = generateSanitizedEnvProduction(sampleEnvTemplate, currentEnv);

      // Public values preserved
      expect(result.sanitizedContent).toContain('NEXT_PUBLIC_APP_URL=https://my-agency.agencyos.network');
      expect(result.sanitizedContent).toContain('BETTER_AUTH_URL=https://sophia.agencyos.network');
      expect(result.sanitizedContent).toContain('IS_CONFIGURED=true');
      expect(result.sanitizedContent).toContain('RESEND_FROM_EMAIL=noreply@sophia.agencyos.network');
      expect(result.sanitizedContent).toContain('FEATURE_PAYOS=0');

      // Secrets redacted with length indicators
      expect(result.sanitizedContent).toContain('BETTER_AUTH_SECRET=[REDACTED_SECRET:len=39]');
      expect(result.sanitizedContent).toContain('NOWPAYMENTS_API_KEY=[REDACTED_API_KEY:len=34]');
      expect(result.sanitizedContent).toContain('NOWPAYMENTS_IPN_SECRET=[REDACTED_SECRET:len=24]');
      expect(result.sanitizedContent).toContain('RESEND_API_KEY=[REDACTED_API_KEY:len=27]');
      expect(result.sanitizedContent).toContain('API_ENCRYPTION_KEY=[REDACTED_KEY:len=40]');
      expect(result.sanitizedContent).toContain('BYOK_MASTER_KEY=[REDACTED_KEY:len=38]');
      expect(result.sanitizedContent).toContain('CRON_SECRET=[REDACTED_SECRET:len=36]');

      // No missing mandatory keys
      expect(result.missingKeys).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('detects and flags missing mandatory production keys', () => {
      const emptyEnv: Record<string, string> = {
        // Omitting BETTER_AUTH_SECRET, NOWPAYMENTS_API_KEY, RESEND_API_KEY, etc.
      };

      const result = generateSanitizedEnvProduction(sampleEnvTemplate, emptyEnv);

      expect(result.missingKeys).toContain('BETTER_AUTH_SECRET');
      expect(result.missingKeys).toContain('NOWPAYMENTS_API_KEY');
      expect(result.missingKeys).toContain('NOWPAYMENTS_IPN_SECRET');
      expect(result.missingKeys).toContain('RESEND_API_KEY');
      expect(result.missingKeys).toContain('API_ENCRYPTION_KEY');
      expect(result.missingKeys).toContain('BYOK_MASTER_KEY');
      expect(result.missingKeys).toContain('CRON_SECRET');

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.sanitizedContent).toContain('# ⚠️ WARNING: MISSING MANDATORY CONFIGURATION KEY: BETTER_AUTH_SECRET');
    });

    it('counts sections and total keys accurately', () => {
      const result = generateSanitizedEnvProduction(sampleEnvTemplate, {});
      expect(result.sectionCount).toBeGreaterThanOrEqual(4);
      expect(result.totalKeys).toBe(14);
    });

    it('handles values containing multiple equal signs (e.g. Base64 strings)', () => {
      const template = `
# Section
OAUTH_TOKEN_KEY=base64_encoded==
SENSITIVE_KEY=another_base64_val==
PUBLIC_URL=https://example.com/oauth?param=1&other=2
      `.trim();

      const currentEnv = {
        OAUTH_TOKEN_KEY: 'rt_base64_secret_val==',
        SENSITIVE_KEY: 'secret_val_with_padding==',
        PUBLIC_URL: 'https://example.com/oauth?param=1&other=2',
      };

      const result = generateSanitizedEnvProduction(template, currentEnv);
      expect(result.sanitizedContent).toContain('OAUTH_TOKEN_KEY=[REDACTED_TOKEN:len=22]');
      expect(result.sanitizedContent).toContain('SENSITIVE_KEY=[REDACTED_SECRET:len=25]');
      expect(result.sanitizedContent).toContain('PUBLIC_URL=https://example.com/oauth?param=1&other=2');
    });

    it('handles empty template without crashing', () => {
      const result = generateSanitizedEnvProduction('', {});
      expect(result.totalKeys).toBe(0);
      expect(result.missingKeys).toHaveLength(0);
      expect(result.sanitizedContent).toContain('SANITIZED CUSTOMER PRODUCTION ENVIRONMENT EXPORT');
    });
  });
});
