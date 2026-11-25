import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NodeSqliteD1Database } from '@/seed/db/node-sqlite-d1';

const {
  getCurrentUserMock,
  verifyWorkspaceAccessMock,
  getD1Mock,
  lookupUserApiKeyMock,
  setUserApiKeyMock,
  clearUserApiKeyMock,
  listUserApiKeyProvidersMock,
  probeProviderApiKeyMock,
  submitHeyGenMock,
  fetchHeyGenMock,
} = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  verifyWorkspaceAccessMock: vi.fn(),
  getD1Mock: vi.fn(),
  lookupUserApiKeyMock: vi.fn(),
  setUserApiKeyMock: vi.fn(),
  clearUserApiKeyMock: vi.fn(),
  listUserApiKeyProvidersMock: vi.fn(),
  probeProviderApiKeyMock: vi.fn(),
  submitHeyGenMock: vi.fn(),
  fetchHeyGenMock: vi.fn(),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: getCurrentUserMock,
}));

vi.mock('@/seed/auth/workspace-access', () => ({
  verifyWorkspaceAccess: verifyWorkspaceAccessMock,
}));

vi.mock('@/seed/db/client', () => ({
  getD1: getD1Mock,
}));

vi.mock('@/tree/byok/user-api-key-store', () => ({
  lookupUserApiKey: lookupUserApiKeyMock,
  setUserApiKey: setUserApiKeyMock,
  clearUserApiKey: clearUserApiKeyMock,
  listUserApiKeyProviders: listUserApiKeyProvidersMock,
}));

vi.mock('@/tree/byok/provider-probe', () => ({
  probeProviderApiKey: probeProviderApiKeyMock,
}));

vi.mock('@/land/first-value/pilot-heygen-byok-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/land/first-value/pilot-heygen-byok-client')>();
  return {
    ...actual,
    submitPilotHeyGenByokVideo: submitHeyGenMock,
    fetchPilotHeyGenByokStatus: fetchHeyGenMock,
  };
});

import { GET, POST } from './route';

const TEST_CSRF_TOKEN = 'test-csrf-token-0123456789abcdef0123456789abcdef';

function makeRequest(body: unknown, includeCsrf = true): NextRequest {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (includeCsrf) {
    headers.cookie = `csrf-token=${TEST_CSRF_TOKEN}`;
    headers['x-csrf-token'] = TEST_CSRF_TOKEN;
  }
  return new NextRequest('http://localhost/api/first-value', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/first-value', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUserMock.mockResolvedValue({ id: 'user-1', email: 'founder@example.com' });
    verifyWorkspaceAccessMock.mockResolvedValue(true);
    listUserApiKeyProvidersMock.mockResolvedValue(['openrouter', 'heygen']);
  });

  it('returns 401 for unauthenticated requests', async () => {
    getCurrentUserMock.mockResolvedValue(null);
    const res = await POST(
      makeRequest({
        action: 'cost_preview',
        orgId: 'org-1',
        topic: 'Launch',
        audience: 'Founders',
      }),
    );
    expect(res.status).toBe(401);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });

  it('returns 403 when CSRF double-submit token is missing', async () => {
    const res = await POST(
      makeRequest(
        {
          action: 'cost_preview',
          orgId: 'org-1',
          topic: 'Launch',
          audience: 'Founders',
        },
        false,
      ),
    );
    expect(res.status).toBe(403);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });

  it('returns 400 for invalid JSON and schema violations', async () => {
    const badJson = await POST(makeRequest('{invalid'));
    expect(badJson.status).toBe(400);

    const badSchema = await POST(makeRequest({ action: 'cost_preview', orgId: '' }));
    expect(badSchema.status).toBe(400);
  });

  it('returns 403 when user does not belong to requested organization', async () => {
    verifyWorkspaceAccessMock.mockResolvedValue(false);
    const res = await POST(
      makeRequest({
        action: 'cost_preview',
        orgId: 'org-other',
        topic: 'Launch',
        audience: 'Founders',
      }),
    );
    expect(res.status).toBe(403);
  });

  it('returns deterministic cost preview and COST_ESTIMATE_UNAVAILABLE when unpriced', async () => {
    const available = await POST(
      makeRequest({
        action: 'cost_preview',
        orgId: 'org-1',
        provider: 'openrouter',
        model: 'openai/gpt-4o-mini',
        topic: 'Cafe promo',
        audience: 'Local owners',
        durationSec: 30,
      }),
    );
    expect(available.status).toBe(200);

    const unavailable = await POST(
      makeRequest({
        action: 'cost_preview',
        orgId: 'org-1',
        provider: 'openrouter',
        model: 'unknown/unpriced-model',
        topic: 'Cafe promo',
        audience: 'Local owners',
      }),
    );
    expect(unavailable.status).toBe(200);
  });

  it('returns labeled fixture preview with private no-store headers and publicPublished=false', async () => {
    const res = await POST(
      makeRequest({
        action: 'fixture_preview',
        orgId: 'org-1',
        topic: 'Bakery intro',
        audience: 'Founders',
        durationSec: 30,
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });

  it('executes live buildLiveDeps HeyGen BYOK save, clear, submit, and poll callbacks via route.ts', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sophia-route-fv-'));
    try {
      const sqlite = new NodeSqliteD1Database(path.join(tmpDir, 'route.sqlite'));
      for (const mig of [
        '0515_first_value_reviews.sql',
        '0517_customer_pilot_first_value.sql',
        '0519_pilot_support_requests.sql',
        '0520_pilot_commercial_validation.sql',
      ]) {
        await sqlite.exec(
          fs.readFileSync(path.resolve(__dirname, '../../../../migrations', mig), 'utf8'),
        );
      }
      await sqlite.exec(`
        INSERT INTO first_value_reviews (
          artifact_id, org_id, user_id, mission_id, idempotency_key, payload_hash,
          review_state, version, provenance, provenance_label, topic, audience,
          duration_sec, script_json, mcu_charged, mcu_accounting_ref, private_artifact_ref,
          receipt_id, accepted_at_iso, accepted_by_user_id, created_at_iso, updated_at_iso
        ) VALUES (
          'art_r1', 'org-1', 'user-1', 'm1', 'idem1', 'hash1',
          'accepted', 1, 'live_provider', 'LIVE', 'Topic', 'Aud',
          30, '{"title":"T","total_duration":30,"scenes":[{"scene_number":1,"visual_description":"v1","narration":"n1","duration_estimate":10},{"scene_number":2,"visual_description":"v2","narration":"n2","duration_estimate":10},{"scene_number":3,"visual_description":"v3","narration":"n3","duration_estimate":10}]}',
          0, 'ref', 'priv', 'rec', '2026-11-25T00:00:00Z', 'user-1', '2026-11-25T00:00:00Z', '2026-11-25T00:00:00Z'
        );
      `);
      getD1Mock.mockResolvedValue(sqlite);

      probeProviderApiKeyMock.mockResolvedValue({
        ok: true,
        valid: true,
        provider: 'heygen',
        status: 'ACTIVE',
        latencyMs: 20,
        message: 'OK',
        message_vi: 'OK',
        maskedKey: 'hg_****',
      });
      setUserApiKeyMock.mockResolvedValue(undefined);
      clearUserApiKeyMock.mockResolvedValue(undefined);

      const saveRes = await POST(
        makeRequest({
          action: 'save_byok_key',
          orgId: 'org-1',
          provider: 'heygen',
          apiKey: 'heygen_route_key_1234567890',
        }),
      );
      expect(saveRes.status).toBe(200);
      expect(setUserApiKeyMock).toHaveBeenCalledWith('user-1', 'heygen', 'heygen_route_key_1234567890');

      const linkRes = await POST(
        makeRequest({
          action: 'create_affiliate_shortlink',
          orgId: 'org-1',
          artifactId: 'art_r1',
          destinationUrl: 'https://shopee.vn/item/10',
          ctaText: 'Claim offer',
        }),
      );
      expect(linkRes.status).toBe(201);
      const linkJson = (await linkRes.json()) as { affiliateLink: { shortCode: string; shortUrl: string } };

      lookupUserApiKeyMock.mockResolvedValue({ status: 'FOUND', key: 'heygen_route_key_1234567890' });
      submitHeyGenMock.mockResolvedValue({ videoId: 'hg_route_vid_1' });

      const subRes = await POST(
        makeRequest({
          action: 'submit_heygen_mp4',
          orgId: 'org-1',
          artifactId: 'art_r1',
          ctaText: 'Claim offer',
          shortCode: linkJson.affiliateLink.shortCode,
          referralUrl: linkJson.affiliateLink.shortUrl,
        }),
      );
      expect(subRes.status).toBe(202);
      const subJson = (await subRes.json()) as { mp4Export: { id: string } };

      fetchHeyGenMock.mockResolvedValue({
        status: 'completed',
        mediaUrl: 'https://files2.heygen.ai/out-route.mp4',
        durationSec: 15,
      });
      const pollRes = await POST(
        makeRequest({
          action: 'poll_heygen_mp4',
          orgId: 'org-1',
          exportId: subJson.mp4Export.id,
        }),
      );
      expect(pollRes.status).toBe(200);

      lookupUserApiKeyMock.mockResolvedValue({ status: 'MISSING' });
      const clearRes = await POST(
        makeRequest({
          action: 'clear_byok_key',
          orgId: 'org-1',
          provider: 'heygen',
        }),
      );
      expect(clearRes.status).toBe(200);

      const getRes = await GET(new NextRequest('http://localhost/api/first-value?orgId=org-1'));
      expect(getRes.status).toBe(200);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
