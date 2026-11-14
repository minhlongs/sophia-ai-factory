/**
 * Circuit-Breaker Isolation Regression Suite for Setup Wizard Resend & HeyGen Helpers
 *
 * Verifies:
 * 1. `sendResendTestEmail`: Customer `401`/`403` invalid API key responses return `422`
 *    WITHOUT opening the circuit breaker (`shouldAllowRequest` stays `true`), so one
 *    customer typo never locks out their own retry or other tenants for 5 minutes.
 * 2. `sendResendTestEmail`: Upstream `5xx` / network errors record failures scoped to
 *    the caller's `keyRef` (`user:${id}`) without tripping other tenants' breakers.
 * 3. `registerHeyGenWebhook`: Network exceptions scope circuit-breaker state to
 *    `keyRef` (`user:${id}`), keeping other tenants' HeyGen auto-registration open.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reset as resetCircuit, shouldAllowRequest } from '@/seed/security/circuit-breaker';
import {
  RESEND_TEST_WIZARD_SERVICE,
  sendResendTestEmail,
} from '../test-resend-helpers';
import { registerHeyGenWebhook } from '@/land/heygen/webhook-registrar';

describe('Setup Wizard Resend & HeyGen circuit-breaker isolation', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    resetCircuit(RESEND_TEST_WIZARD_SERVICE);
    resetCircuit(RESEND_TEST_WIZARD_SERVICE, 'user:tenant_a');
    resetCircuit(RESEND_TEST_WIZARD_SERVICE, 'user:tenant_b');
    resetCircuit('heygen');
    resetCircuit('heygen', 'user:tenant_a');
    resetCircuit('heygen', 'user:tenant_b');
  });

  it('does NOT open the Resend circuit breaker when a customer submits an invalid 401/403 API key', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Invalid API key',
    } as Response);

    const res401 = await sendResendTestEmail('re_bad_key_1', 'ceo@sophia.test', 'user:tenant_a');
    expect(res401.status).toBe(422);

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    } as Response);

    const res403 = await sendResendTestEmail('re_bad_key_2', 'ceo@sophia.test', 'user:tenant_a');
    expect(res403.status).toBe(422);

    // Both tenant_a's scoped breaker and the platform breaker remain open for immediate retry
    expect(shouldAllowRequest(RESEND_TEST_WIZARD_SERVICE, 'user:tenant_a')).toBe(true);
    expect(shouldAllowRequest(RESEND_TEST_WIZARD_SERVICE, 'user:tenant_b')).toBe(true);
    expect(shouldAllowRequest(RESEND_TEST_WIZARD_SERVICE)).toBe(true);

    globalThis.fetch = originalFetch;
  });

  it('scopes Resend 5xx/network circuit-breaker failures per user keyRef without blocking other tenants', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNRESET'));

    for (let i = 0; i < 5; i += 1) {
      const res = await sendResendTestEmail('re_valid_key', 'a@sophia.test', 'user:tenant_a');
      expect(res.status).toBe(502);
    }

    const sixth = await sendResendTestEmail('re_valid_key', 'a@sophia.test', 'user:tenant_a');
    expect(sixth.status).toBe(503);

    expect(shouldAllowRequest(RESEND_TEST_WIZARD_SERVICE, 'user:tenant_a')).toBe(false);
    expect(shouldAllowRequest(RESEND_TEST_WIZARD_SERVICE, 'user:tenant_b')).toBe(true);
    expect(shouldAllowRequest(RESEND_TEST_WIZARD_SERVICE)).toBe(true);

    globalThis.fetch = originalFetch;
  });

  it('scopes HeyGen webhook registration network failures per user keyRef without blocking other tenants', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ETIMEDOUT'));

    for (let i = 0; i < 6; i += 1) {
      const res = await registerHeyGenWebhook(
        'hg_key_a',
        'https://sophia.agencyos.network/api/webhooks/heygen',
        'user:tenant_a',
      );
      expect(res.success).toBe(false);
    }

    expect(shouldAllowRequest('heygen', 'user:tenant_a')).toBe(false);
    expect(shouldAllowRequest('heygen', 'user:tenant_b')).toBe(true);
    expect(shouldAllowRequest('heygen')).toBe(true);

    globalThis.fetch = originalFetch;
  });
});
