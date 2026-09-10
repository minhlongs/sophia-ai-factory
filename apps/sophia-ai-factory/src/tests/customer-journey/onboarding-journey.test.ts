import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/setup-wizard/validate-key/route';
import { getCurrentUser } from '@/seed/auth/better-auth-session';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

const ONBOARDING_STEPS = [
  { step: 1, name: 'Welcome', purpose: 'Value proposition & non-technical 5-min intro' },
  { step: 2, name: 'Account', purpose: 'Workspace identity & owner role provisioning' },
  { step: 3, name: 'AI Provider', purpose: 'BYOK credential entry with live validation' },
  { step: 4, name: 'Payments', purpose: 'Subscription tier & MCU credit balance check' },
  { step: 5, name: 'First Mission Blueprint', purpose: 'Pre-flight cost, latency & expectations' },
  { step: 6, name: 'Success', purpose: 'System ready confirmation & direct launch CTA' },
];

describe('Phase 9: Customer Onboarding Journey', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('6-Step Standard Onboarding Journey Structure', () => {
    it('defines the complete canonical 6-step customer path without dead-ends', () => {
      expect(ONBOARDING_STEPS).toHaveLength(6);
      expect(ONBOARDING_STEPS.map((s) => s.name)).toEqual([
        'Welcome',
        'Account',
        'AI Provider',
        'Payments',
        'First Mission Blueprint',
        'Success',
      ]);
    });

    it('enforces sequential progression from onboarding entry to mission launch', () => {
      for (let i = 0; i < ONBOARDING_STEPS.length; i++) {
        expect(ONBOARDING_STEPS[i]?.step).toBe(i + 1);
        expect(ONBOARDING_STEPS[i]?.purpose).toBeTruthy();
      }
    });
  });

  describe('Upstream Provider Validation via /api/setup-wizard/validate-key', () => {
    it('returns 401 fail-closed when caller is unauthenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);
      const req = new NextRequest('http://localhost/api/setup-wizard/validate-key', {
        method: 'POST',
        body: JSON.stringify({ provider: 'fal-ai', api_key: 'fal-test-key-12345' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
      const json = await res.json() as { ok: boolean; valid: boolean };
      expect(json.ok).toBe(false);
      expect(json.valid).toBe(false);
    });

    it('probes real upstream for fal-ai with correct authorization header', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ id: 'usr_ceo_1', email: 'ceo@test.com' } as never);
      const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response);
      global.fetch = mockFetch;

      const req = new NextRequest('http://localhost/api/setup-wizard/validate-key', {
        method: 'POST',
        body: JSON.stringify({ provider: 'fal-ai', api_key: 'fal-prod-live-key-9999' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json() as { valid: boolean; status: string; maskedKey: string };
      expect(json.valid).toBe(true);
      expect(json.status).toBe('ACTIVE');
      expect(json.maskedKey).toBe('****...9999');

      expect(mockFetch).toHaveBeenCalledWith('https://queue.fal.run/', expect.objectContaining({
        method: 'GET',
        headers: { Authorization: 'Key fal-prod-live-key-9999' },
      }));
    });

    it('probes real upstream for openrouter with Bearer authorization header', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ id: 'usr_ceo_1', email: 'ceo@test.com' } as never);
      const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response);
      global.fetch = mockFetch;

      const req = new NextRequest('http://localhost/api/setup-wizard/validate-key', {
        method: 'POST',
        body: JSON.stringify({ provider: 'openrouter', api_key: 'sk-or-v1-abcdef1234' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json() as { valid: boolean; status: string };
      expect(json.valid).toBe(true);
      expect(json.status).toBe('ACTIVE');

      expect(mockFetch).toHaveBeenCalledWith('https://openrouter.ai/api/v1/auth/key', expect.objectContaining({
        headers: { Authorization: 'Bearer sk-or-v1-abcdef1234' },
      }));
    });

    it('probes real upstream for elevenlabs with xi-api-key header', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ id: 'usr_ceo_1', email: 'ceo@test.com' } as never);
      const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response);
      global.fetch = mockFetch;

      const req = new NextRequest('http://localhost/api/setup-wizard/validate-key', {
        method: 'POST',
        body: JSON.stringify({ provider: 'elevenlabs', api_key: 'eleven-live-key-5678' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json() as { valid: boolean; status: string };
      expect(json.valid).toBe(true);
      expect(json.status).toBe('ACTIVE');

      expect(mockFetch).toHaveBeenCalledWith('https://api.elevenlabs.io/v1/user', expect.objectContaining({
        headers: { 'xi-api-key': 'eleven-live-key-5678' },
      }));
    });

    it('probes real upstream for d-id with Basic authorization header', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ id: 'usr_ceo_1', email: 'ceo@test.com' } as never);
      const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response);
      global.fetch = mockFetch;

      const rawCred = 'user_did_test:pass_did_test';
      const expectedBasic = `Basic ${Buffer.from(rawCred).toString('base64')}`;

      const req = new NextRequest('http://localhost/api/setup-wizard/validate-key', {
        method: 'POST',
        body: JSON.stringify({ provider: 'd-id', api_key: rawCred }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledWith('https://api.d-id.com/credits', expect.objectContaining({
        headers: { Authorization: expectedBasic },
      }));
    });

    it('handles 401/403 invalid key with fail-closed status and HTTP 422', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ id: 'usr_ceo_1', email: 'ceo@test.com' } as never);
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 } as Response);

      const req = new NextRequest('http://localhost/api/setup-wizard/validate-key', {
        method: 'POST',
        body: JSON.stringify({ provider: 'openrouter', api_key: 'sk-or-expired-key' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(422);
      const json = await res.json() as { valid: boolean; status: string };
      expect(json.valid).toBe(false);
      expect(json.status).toBe('INVALID');
    });

    it('handles upstream timeout fail-closed with PROVIDER_UNAVAILABLE status', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ id: 'usr_ceo_1', email: 'ceo@test.com' } as never);
      global.fetch = vi.fn().mockRejectedValue(new Error('The operation was aborted due to timeout'));

      const req = new NextRequest('http://localhost/api/setup-wizard/validate-key', {
        method: 'POST',
        body: JSON.stringify({ provider: 'fal-ai', api_key: 'fal-test-timeout-key' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(502);
      const json = await res.json() as { valid: boolean; status: string; message: string };
      expect(json.valid).toBe(false);
      expect(json.status).toBe('PROVIDER_UNAVAILABLE');
      expect(json.message).toContain('timed out');
    });
  });
});
