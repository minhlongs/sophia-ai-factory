/**
 * Safe Diagnostics Bundle Safety & Redaction Test Suite.
 *
 * Enforces Phase 9 invariants:
 * 1. 100% Redaction of confidential credentials:
 *    - API keys (sk-*, fal_*, r8_*, etc.)
 *    - Bearer tokens & JWTs
 *    - Database connection strings & passwords
 *    - Cookies, session headers, and raw PII
 * 2. Safe exposure of operational metadata:
 *    - Sophia version & commit SHA
 *    - Safe masked tenant & user IDs
 *    - Valid capability states
 *    - Generic sanitized error categories
 *
 * @module tree/diagnostics/__tests__/diagnostic-bundle-safety.test
 */

import { describe, it, expect } from 'vitest';
import {
  generateSafeDiagnosticBundle,
  redactSensitiveData,
  maskIdentifier,
  categorizeError,
} from '../safe-bundle-generator';

describe('Phase 9: Diagnostic Bundle Redaction & Safety Guarantees', () => {
  it('redacts API keys and provider tokens completely', () => {
    const rawLogs = [
      'Failed with OpenAI key sk-ant-api03-1234567890abcdef',
      'fal-ai error with key fal_secret_key_987654321',
      'Replicate token r8_live_token_abcdef12345 rejected',
    ];

    for (const log of rawLogs) {
      const sanitized = redactSensitiveData(log);
      expect(sanitized).not.toContain('sk-ant-api03-1234567890abcdef');
      expect(sanitized).not.toContain('fal_secret_key_987654321');
      expect(sanitized).not.toContain('r8_live_token_abcdef12345');
      expect(sanitized).toContain('[REDACTED]');
    }
  });

  it('redacts Bearer tokens, JWTs, and session cookies', () => {
    const sensitiveStrings = [
      'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotLeakThisSignature',
      'Set-Cookie: session_token=secret_sess_cookie_val_12345; Path=/',
    ];

    for (const str of sensitiveStrings) {
      const sanitized = redactSensitiveData(str);
      expect(sanitized).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      expect(sanitized).not.toContain('secret_sess_cookie_val_12345');
      expect(sanitized).toContain('[REDACTED]');
    }
  });

  it('redacts database connection URIs and raw passwords', () => {
    const dbStrings = [
      'Error connecting to postgres://admin:superSecretPassword123@db.prod.internal:5432/sophia_db',
      'Config check: password := "mySuperSecretPassword!"',
      'mongodb://root:mypassword@mongo.host:27017/analytics',
    ];

    for (const str of dbStrings) {
      const sanitized = redactSensitiveData(str);
      expect(sanitized).not.toContain('superSecretPassword123');
      expect(sanitized).not.toContain('mySuperSecretPassword!');
      expect(sanitized).not.toContain('postgres://');
      expect(sanitized).toContain('[REDACTED]');
    }
  });

  it('masks tenant and user IDs preventing identifier leakage', () => {
    expect(maskIdentifier('usr_1234567890abcdef', 'usr')).toBe('usr_***abcdef');
    expect(maskIdentifier('ws_enterprise_acme_corp', 'ws')).toBe('ws_***e_corp');
    expect(maskIdentifier('', 'usr')).toBe('usr_anon');
  });

  it('converts raw error details into coarse-grained enum categories', () => {
    expect(categorizeError('Invalid API key provided for fal-ai 401')).toBe('AUTH_CREDENTIAL_ERROR');
    expect(categorizeError('429 Too Many Requests: Rate limit exceeded')).toBe('RATE_LIMIT_EXCEEDED');
    expect(categorizeError('402 Insufficient MCU balance')).toBe('INSUFFICIENT_CREDITS');
    expect(categorizeError('fetch failed: socket timeout after 30000ms')).toBe('NETWORK_UNAVAILABLE');
    expect(categorizeError('D1_ERROR: SQLite disk or table error')).toBe('PERSISTENCE_LAYER_ERROR');
  });

  it('generates a complete, verified safe diagnostic bundle', () => {
    const bundle = generateSafeDiagnosticBundle({
      userId: 'usr_secret_customer_123456',
      workspaceId: 'ws_tenant_987654',
      appVersion: '1.0.0',
      commitSha: 'c3b2e7e6abcdef12',
      capabilities: ['AI_IMAGE', 'AI_VIDEO'],
      providerStatuses: [
        { name: 'fal-ai', configured: true, status: 'ACTIVE' },
        { name: 'openrouter', configured: true, status: 'ACTIVE' },
      ],
      rawErrorLogs: [
        'OpenRouter failed with 429 rate limit exceeded',
        'Unauthorized 401 using key sk-secret123456',
      ],
      systemHealth: 'OPERATIONAL',
      environment: 'production',
    });

    // Verify metadata
    expect(bundle.app.name).toBe('Sophia AI Factory');
    expect(bundle.app.version).toBe('1.0.0');
    expect(bundle.app.commitSha).toBe('c3b2e7e6');
    expect(bundle.context.maskedUserId).toBe('usr_***123456');
    expect(bundle.context.maskedWorkspaceId).toBe('ws_***987654');

    // Capabilities safe exposure
    expect(bundle.capabilities.available).toEqual(['AI_IMAGE', 'AI_VIDEO']);
    expect(bundle.capabilities.providersCount).toBe(2);

    // Errors categorized without leaking raw key
    expect(bundle.diagnostics.recentErrorCategories).toContain('RATE_LIMIT_EXCEEDED');
    expect(bundle.diagnostics.recentErrorCategories).toContain('AUTH_CREDENTIAL_ERROR');
    expect(JSON.stringify(bundle)).not.toContain('sk-secret123456');

    // Verification audit
    expect(bundle.redactionAudit.isSanitized).toBe(true);
    expect(bundle.redactionAudit.redactedFields).toContain('api_keys');
    expect(bundle.redactionAudit.redactedFields).toContain('database_connection_urls');
  });
});
