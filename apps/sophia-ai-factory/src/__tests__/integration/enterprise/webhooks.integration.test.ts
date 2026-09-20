/**
 * Comprehensive Integration Tests for Enterprise Outbound Webhooks & Event Bus (Milestone 4)
 *
 * Uses in-memory SQLite D1 shim to test:
 * 1. D1 migration 0279 webhook_endpoints and webhook_deliveries schema lifecycle
 * 2. Subscription CRUD, HTTPS validation, and event matching (subscription-repo.ts)
 * 3. Outbound dispatch and HMAC signature verification (delivery-bus.ts)
 * 4. Resilient retry engine, backoff delay calculation, and DLQ state transition
 * 5. Manual replay API, tenant isolation defenses (CROSS_TENANT_VIOLATION)
 * 6. Batch background retry processing (processDueWebhookRetries)
 * 7. Server Actions (land/admin/webhook-actions.ts) with 5-tier RBAC enforcement
 * 8. Edge Route Handlers (app/api/v1/webhooks/route.ts)
 *
 * Layer: Integration Tests
 *
 * @module __tests__/integration/enterprise/webhooks.integration.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { freshDb, makeD1 } from '../shared-d1-shim';
import type { D1Database } from '@/seed/db/client';

const mocks = vi.hoisted(() => ({
  mockGetD1: vi.fn(),
  mockGetCurrentUser: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: mocks.mockGetD1,
  createServerClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: {}, error: null }),
        }),
      }),
    }),
  }),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: mocks.mockGetCurrentUser,
  getCurrentUserFromHeaders: vi.fn().mockImplementation(() => mocks.mockGetCurrentUser()),
}));

import {
  createWebhookEndpoint,
  getWebhookEndpointById,
  listWebhookEndpointsByOrg,
  updateWebhookEndpoint,
  deleteWebhookEndpoint,
  findMatchingEndpointsForEvent,
} from '@/tree/webhooks/subscription-repo';
import {
  dispatchWebhookDelivery,
  processWebhookRetry,
  replayWebhookAttempt,
  processDueWebhookRetries,
} from '@/forest/webhooks/delivery-bus';
import { verifyWebhookSignature } from '@/seed/security/hmac-signer';
import {
  createWebhookEndpointAction,
  replayWebhookAction,
  listWebhooksAction,
  deleteWebhookEndpointAction,
} from '@/land/admin/webhook-actions';
import { GET as apiGetWebhooks, POST as apiPostWebhooks } from '@/app/api/v1/webhooks/route';
import { NextRequest } from 'next/server';

const MIGRATION_0279_SQL = `
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  tier TEXT NOT NULL DEFAULT 'master',
  max_seats INTEGER NOT NULL DEFAULT 999,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS organization_members (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (org_id, user_id)
);

CREATE TABLE IF NOT EXISTS org_members (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (org_id, user_id)
);

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id TEXT PRIMARY KEY DEFAULT ('wep_' || lower(hex(randomblob(12)))),
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  url TEXT NOT NULL CHECK (url LIKE 'https://%'),
  secret TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  events TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id TEXT PRIMARY KEY DEFAULT ('del_' || lower(hex(randomblob(12)))),
  endpoint_id TEXT NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'success', 'failed', 'dead_letter')
  ),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  next_attempt_at INTEGER NOT NULL,
  response_code INTEGER DEFAULT NULL,
  error_message TEXT DEFAULT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
`;

describe('Enterprise Outbound Webhooks — Integration Tests', () => {
  let sqliteDb: ReturnType<typeof freshDb>;
  let d1: ReturnType<typeof makeD1>;

  const orgA = 'org_webhook_integration_a';
  const orgB = 'org_webhook_integration_b';
  const userAdminId = 'usr_admin_org_a';
  const userViewerId = 'usr_viewer_org_a';

  beforeEach(() => {
    sqliteDb = freshDb();
    sqliteDb.exec(MIGRATION_0279_SQL);
    d1 = makeD1(sqliteDb);

    mocks.mockGetD1.mockResolvedValue(d1 as unknown as D1Database);

    // Seed test organizations
    const now = Date.now();
    sqliteDb.exec(`
      INSERT INTO organizations (id, name, slug, tier, max_seats, status, created_at, updated_at)
      VALUES 
        ('${orgA}', 'Organization A', 'org-a', 'master', 999, 'active', ${now}, ${now}),
        ('${orgB}', 'Organization B', 'org-b', 'master', 999, 'active', ${now}, ${now});

      INSERT INTO users (id, email, name, role, created_at, updated_at)
      VALUES 
        ('${userAdminId}', 'admin@orga.com', 'Admin User', 'user', ${now}, ${now}),
        ('${userViewerId}', 'viewer@orga.com', 'Viewer User', 'user', ${now}, ${now});

      INSERT INTO organization_members (id, org_id, user_id, role, created_at, updated_at)
      VALUES 
        ('mem_admin_a', '${orgA}', '${userAdminId}', 'admin', ${now}, ${now}),
        ('mem_viewer_a', '${orgA}', '${userViewerId}', 'viewer', ${now}, ${now});

      INSERT INTO org_members (id, org_id, user_id, role, created_at, updated_at)
      VALUES 
        ('omem_admin_a', '${orgA}', '${userAdminId}', 'admin', ${now}, ${now}),
        ('omem_viewer_a', '${orgA}', '${userViewerId}', 'viewer', ${now}, ${now});
    `);
  });

  // ============================================================================
  // 1. SUBSCRIPTION REPOSITORY INTEGRATION
  // ============================================================================
  describe('1. Subscription Repository CRUD', () => {
    it('creates and persists an HTTPS webhook subscription with secret and events', async () => {
      const endpoint = await createWebhookEndpoint(d1 as unknown as D1Database, orgA, {
        url: 'https://api.partner.com/events',
        events: ['video.rendered', 'campaign.completed'],
        description: 'Primary Partner Webhook',
      });

      expect(endpoint.id).toMatch(/^wep_/);
      expect(endpoint.secret).toMatch(/^whsec_/);
      expect(endpoint.url).toBe('https://api.partner.com/events');
      expect(endpoint.events).toEqual(['video.rendered', 'campaign.completed']);
      expect(endpoint.status).toBe('active');

      const retrieved = await getWebhookEndpointById(d1 as unknown as D1Database, endpoint.id, orgA);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(endpoint.id);
      expect(retrieved?.description).toBe('Primary Partner Webhook');
    });

    it('rejects creation with non-HTTPS URLs at the repository layer', async () => {
      await expect(
        createWebhookEndpoint(d1 as unknown as D1Database, orgA, {
          url: 'http://insecure.endpoint.com/events',
          events: ['video.rendered'],
        })
      ).rejects.toThrow(/INVALID_WEBHOOK_URL/);
    });

    it('updates existing webhook endpoint fields', async () => {
      const endpoint = await createWebhookEndpoint(d1 as unknown as D1Database, orgA, {
        url: 'https://api.partner.com/v1',
        events: ['video.rendered'],
      });

      const updated = await updateWebhookEndpoint(d1 as unknown as D1Database, orgA, endpoint.id, {
        url: 'https://api.partner.com/v2',
        events: ['video.rendered', 'commission.earned'],
        status: 'disabled',
      });

      expect(updated.url).toBe('https://api.partner.com/v2');
      expect(updated.events).toEqual(['video.rendered', 'commission.earned']);
      expect(updated.status).toBe('disabled');
    });

    it('deletes existing webhook endpoint from database', async () => {
      const endpoint = await createWebhookEndpoint(d1 as unknown as D1Database, orgA, {
        url: 'https://api.partner.com/delete-me',
        events: ['*'],
      });

      const deleted = await deleteWebhookEndpoint(d1 as unknown as D1Database, orgA, endpoint.id);
      expect(deleted).toBe(true);

      const check = await getWebhookEndpointById(d1 as unknown as D1Database, endpoint.id);
      expect(check).toBeNull();
    });

    it('findMatchingEndpointsForEvent discovers active subscribed endpoints', async () => {
      await createWebhookEndpoint(d1 as unknown as D1Database, orgA, {
        url: 'https://api.orgA.com/videos',
        events: ['video.rendered'],
      });
      await createWebhookEndpoint(d1 as unknown as D1Database, orgA, {
        url: 'https://api.orgA.com/all',
        events: ['*'],
      });
      await createWebhookEndpoint(d1 as unknown as D1Database, orgA, {
        url: 'https://api.orgA.com/payouts',
        events: ['payout.processed'],
      });

      const matching = await findMatchingEndpointsForEvent(d1 as unknown as D1Database, orgA, 'video.rendered');
      expect(matching).toHaveLength(2);
      expect(matching.map((m) => m.url)).toEqual(
        expect.arrayContaining(['https://api.orgA.com/videos', 'https://api.orgA.com/all'])
      );
    });
  });

  // ============================================================================
  // 2. TENANT ISOLATION DEFENSES
  // ============================================================================
  describe('2. Multi-Tenant Scoping & Isolation Defenses', () => {
    it('enforces tenant isolation on getWebhookEndpointById with expectedOrgId', async () => {
      const endpointA = await createWebhookEndpoint(d1 as unknown as D1Database, orgA, {
        url: 'https://api.orga.com/wh',
        events: ['video.rendered'],
      });

      // Org B attempts to access Org A's endpoint
      await expect(
        getWebhookEndpointById(d1 as unknown as D1Database, endpointA.id, orgB)
      ).rejects.toThrow(/CROSS_TENANT_VIOLATION/);
    });

    it('isolates listWebhookEndpointsByOrg strictly per organization', async () => {
      await createWebhookEndpoint(d1 as unknown as D1Database, orgA, {
        url: 'https://api.orga.com/wh',
        events: ['video.rendered'],
      });
      await createWebhookEndpoint(d1 as unknown as D1Database, orgB, {
        url: 'https://api.orgb.com/wh',
        events: ['video.rendered'],
      });

      const listA = await listWebhookEndpointsByOrg(d1 as unknown as D1Database, orgA);
      const listB = await listWebhookEndpointsByOrg(d1 as unknown as D1Database, orgB);

      expect(listA).toHaveLength(1);
      expect(listA[0].org_id).toBe(orgA);

      expect(listB).toHaveLength(1);
      expect(listB[0].org_id).toBe(orgB);
    });

    it('rejects cross-tenant manual replay attempts with CROSS_TENANT_VIOLATION', async () => {
      const endpointA = await createWebhookEndpoint(d1 as unknown as D1Database, orgA, {
        url: 'https://api.orga.com/wh',
        events: ['video.rendered'],
      });

      const deliveryA = await dispatchWebhookDelivery(
        d1 as unknown as D1Database,
        endpointA,
        'video.rendered',
        { id: 'vid_1' },
        async () => ({ status: 500, ok: false })
      );

      // Org B attempts to trigger replay on Org A's delivery record
      await expect(
        replayWebhookAttempt(d1 as unknown as D1Database, orgB, deliveryA.id)
      ).rejects.toThrow(/CROSS_TENANT_VIOLATION/);
    });
  });

  // ============================================================================
  // 3. OUTBOUND DISPATCH & RETRY LIFECYCLE
  // ============================================================================
  describe('3. Outbound Dispatch, Retry & DLQ Lifecycle', () => {
    it('dispatches delivery and injects valid X-Sophia-Signature and X-Sophia-Event headers', async () => {
      const endpoint = await createWebhookEndpoint(d1 as unknown as D1Database, orgA, {
        url: 'https://api.partner.com/receiver',
        events: ['video.rendered'],
      });

      let capturedHeaders: Record<string, string> = {};
      let capturedBody = '';

      const delivery = await dispatchWebhookDelivery(
        d1 as unknown as D1Database,
        endpoint,
        'video.rendered',
        { videoId: 'vid_100', cost: 25 },
        async (_url, headers, body) => {
          capturedHeaders = headers;
          capturedBody = body;
          return { status: 200, ok: true };
        }
      );

      expect(delivery.status).toBe('success');
      expect(delivery.response_code).toBe(200);
      expect(capturedHeaders['X-Sophia-Event']).toBe('video.rendered');
      expect(capturedHeaders['X-Sophia-Signature']).toMatch(/^t=\d+,v1=[a-f0-9]{64}$/);

      // Verify HMAC signature authenticity
      const isValid = await verifyWebhookSignature(
        endpoint.secret,
        capturedBody,
        capturedHeaders['X-Sophia-Signature']
      );
      expect(isValid).toBe(true);
    });

    it('rejects dispatch when event is not subscribed', async () => {
      const endpoint = await createWebhookEndpoint(d1 as unknown as D1Database, orgA, {
        url: 'https://api.partner.com/receiver',
        events: ['video.rendered'],
      });

      await expect(
        dispatchWebhookDelivery(d1 as unknown as D1Database, endpoint, 'payout.processed', { id: 'p_1' })
      ).rejects.toThrow(/EVENT_NOT_SUBSCRIBED/);
    });

    it('transitions to dead_letter (DLQ) after 5 exhausted retry attempts', async () => {
      const endpoint = await createWebhookEndpoint(d1 as unknown as D1Database, orgA, {
        url: 'https://api.failing.com/wh',
        events: ['video.rendered'],
      });

      // Initial dispatch failure (attempt 1)
      let delivery = await dispatchWebhookDelivery(
        d1 as unknown as D1Database,
        endpoint,
        'video.rendered',
        { payload: 'test' },
        async () => ({ status: 503, ok: false })
      );
      expect(delivery.attempt_count).toBe(1);
      expect(delivery.status).toBe('failed');

      // Attempts 2, 3, 4 remain failed
      for (let i = 2; i <= 4; i++) {
        delivery = await processWebhookRetry(
          d1 as unknown as D1Database,
          delivery.id,
          async () => ({ status: 503, ok: false })
        );
        expect(delivery.attempt_count).toBe(i);
        expect(delivery.status).toBe('failed');
      }

      // Final attempt 5 transitions to dead_letter
      delivery = await processWebhookRetry(
        d1 as unknown as D1Database,
        delivery.id,
        async () => ({ status: 503, ok: false })
      );
      expect(delivery.attempt_count).toBe(5);
      expect(delivery.status).toBe('dead_letter');

      // Manual replay successfully recovers to success with X-Sophia-Replay header
      const replayed = await replayWebhookAttempt(
        d1 as unknown as D1Database,
        orgA,
        delivery.id,
        async (_url, headers) => {
          expect(headers['X-Sophia-Replay']).toBe('true');
          return { status: 200, ok: true };
        }
      );
      expect(replayed.status).toBe('success');
      expect(replayed.response_code).toBe(200);
    });

    it('processDueWebhookRetries processes batch of failed deliveries', async () => {
      const endpoint = await createWebhookEndpoint(d1 as unknown as D1Database, orgA, {
        url: 'https://api.transient.com/wh',
        events: ['*'],
      });

      const d1Record = await dispatchWebhookDelivery(
        d1 as unknown as D1Database,
        endpoint,
        'video.rendered',
        { id: '1' },
        async () => ({ status: 500, ok: false })
      );

      // Fast forward next_attempt_at in DB to past
      sqliteDb.exec(`UPDATE webhook_deliveries SET next_attempt_at = ${Date.now() - 5000} WHERE id = '${d1Record.id}'`);

      const summary = await processDueWebhookRetries(d1 as unknown as D1Database);
      expect(summary.processed).toBe(1);
    });
  });

  // ============================================================================
  // 4. LAND SERVER ACTIONS & RBAC GATING
  // ============================================================================
  describe('4. Server Actions & 5-Tier RBAC Gating', () => {
    it('allows org admin to create webhook endpoint via createWebhookEndpointAction', async () => {
      mocks.mockGetCurrentUser.mockResolvedValue({ id: userAdminId, email: 'admin@orga.com', role: 'user' });

      const result = await createWebhookEndpointAction({
        orgId: orgA,
        url: 'https://api.action.com/webhook',
        events: ['video.rendered'],
        description: 'Action Created',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.url).toBe('https://api.action.com/webhook');
        expect(result.value.org_id).toBe(orgA);
      }
    });

    it('denies org viewer with INSUFFICIENT_PERMISSIONS', async () => {
      mocks.mockGetCurrentUser.mockResolvedValue({ id: userViewerId, email: 'viewer@orga.com', role: 'user' });

      const result = await createWebhookEndpointAction({
        orgId: orgA,
        url: 'https://api.action.com/webhook',
        events: ['video.rendered'],
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INSUFFICIENT_PERMISSIONS');
      }
    });

    it('masks secrets in listWebhooksAction', async () => {
      mocks.mockGetCurrentUser.mockResolvedValue({ id: userAdminId, email: 'admin@orga.com', role: 'user' });

      await createWebhookEndpoint(d1 as unknown as D1Database, orgA, {
        url: 'https://api.masked.com/wh',
        events: ['video.rendered'],
      });

      const res = await listWebhooksAction(orgA);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value).toHaveLength(1);
        expect((res.value[0] as unknown as { secret?: string }).secret).toBeUndefined();
      }
    });

    it('replays delivery via replayWebhookAction', async () => {
      mocks.mockGetCurrentUser.mockResolvedValue({ id: userAdminId, email: 'admin@orga.com', role: 'user' });

      const ep = await createWebhookEndpoint(d1 as unknown as D1Database, orgA, {
        url: 'https://api.replay.com/wh',
        events: ['*'],
      });

      const delivery = await dispatchWebhookDelivery(
        d1 as unknown as D1Database,
        ep,
        'video.rendered',
        { test: 1 },
        async () => ({ status: 500, ok: false })
      );

      // Replay action
      const res = await replayWebhookAction(orgA, delivery.id);
      expect(res.ok).toBe(true);
    });

    it('deletes endpoint via deleteWebhookEndpointAction', async () => {
      mocks.mockGetCurrentUser.mockResolvedValue({ id: userAdminId, email: 'admin@orga.com', role: 'user' });

      const ep = await createWebhookEndpoint(d1 as unknown as D1Database, orgA, {
        url: 'https://api.delete.com/wh',
        events: ['*'],
      });

      const res = await deleteWebhookEndpointAction(orgA, ep.id);
      expect(res.ok).toBe(true);
    });
  });

  // ============================================================================
  // 5. EDGE API ROUTE HANDLERS
  // ============================================================================
  describe('5. Edge API Route Handlers (/api/v1/webhooks)', () => {
    it('POST /api/v1/webhooks creates endpoint and returns 201 with secret', async () => {
      mocks.mockGetCurrentUser.mockResolvedValue({ id: userAdminId, email: 'admin@orga.com', role: 'user' });

      const req = new NextRequest('https://sophia.agencyos.network/api/v1/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://api.route.com/wh',
          events: ['video.rendered'],
          description: 'Route test',
        }),
      });

      const res = await apiPostWebhooks(req);
      expect(res.status).toBe(201);
      const json = await res.json() as { endpoint: { id: string; url: string; secret: string } };
      expect(json.endpoint.id).toMatch(/^wep_/);
      expect(json.endpoint.secret).toMatch(/^whsec_/);
    });

    it('POST /api/v1/webhooks rejects insecure HTTP URL with 400', async () => {
      mocks.mockGetCurrentUser.mockResolvedValue({ id: userAdminId, email: 'admin@orga.com', role: 'user' });

      const req = new NextRequest('https://sophia.agencyos.network/api/v1/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'http://insecure.route.com/wh',
          events: ['video.rendered'],
        }),
      });

      const res = await apiPostWebhooks(req);
      expect(res.status).toBe(400);
      const json = await res.json() as { error: string };
      expect(json.error).toBe('INVALID_WEBHOOK_URL');
    });

    it('GET /api/v1/webhooks lists endpoints with masked secrets', async () => {
      mocks.mockGetCurrentUser.mockResolvedValue({ id: userAdminId, email: 'admin@orga.com', role: 'user' });

      await createWebhookEndpoint(d1 as unknown as D1Database, orgA, {
        url: 'https://api.get.com/wh',
        events: ['video.rendered'],
      });

      const req = new NextRequest('https://sophia.agencyos.network/api/v1/webhooks', {
        method: 'GET',
      });

      const res = await apiGetWebhooks(req);
      expect(res.status).toBe(200);
      const json = await res.json() as { endpoints: Array<{ id: string; secret?: string }> };
      expect(json.endpoints).toHaveLength(1);
      expect(json.endpoints[0].secret).toBeUndefined();
    });
  });
});
