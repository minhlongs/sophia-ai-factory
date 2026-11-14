/**
 * Gate G8 Security & Isolation Tests for GET /api/realtime/campaign-stream
 *
 * Uses real SQLite-backed FakeD1 to prove:
 * 1. Unauthenticated callers receive 401.
 * 2. Authenticated user of org_alpha requesting ?organization_id=org_beta receives 403.
 * 3. Valid 200 text/event-stream (?once=1) returns ONLY org_alpha approvals & jobs
 *    while org_beta rows in the same D1 database are completely excluded.
 *
 * @module app/api/realtime/campaign-stream/__tests__/route.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakeD1 } from '@/seed/testing/fake-d1-sqlite';
import type { D1Database } from '@/seed/db/client';

const { mockGetCurrentUser, mockGetD1 } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockGetD1: vi.fn(),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock('@/seed/db/client', () => ({
  getD1: mockGetD1,
  createServerClient: () => mockGetD1(),
}));

import { GET, type CampaignStreamSnapshot } from '../route';

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS org_members (
    org_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at INTEGER NOT NULL DEFAULT 1760000000,
    PRIMARY KEY (org_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS publish_ledger (
    idempotency_key TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    media_ref TEXT NOT NULL,
    decision TEXT NOT NULL DEFAULT 'pending',
    requester_id TEXT,
    reviewer_id TEXT,
    comment TEXT,
    approved_at INTEGER,
    expires_at INTEGER,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS publishing_jobs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    status TEXT NOT NULL,
    title TEXT,
    created_at INTEGER NOT NULL
  )`,
];

async function seedMultiTenantD1(): Promise<D1Database> {
  const db = createFakeD1(SCHEMA) as unknown as D1Database;
  await db
    .prepare('INSERT INTO org_members (org_id, user_id, role, created_at) VALUES (?, ?, ?, ?)')
    .bind('org_alpha', 'user_alpha', 'admin', 1760000000)
    .run();
  await db
    .prepare('INSERT INTO org_members (org_id, user_id, role, created_at) VALUES (?, ?, ?, ?)')
    .bind('org_beta', 'user_beta', 'admin', 1760000000)
    .run();

  await db
    .prepare(
      `INSERT INTO publish_ledger (idempotency_key, tenant_id, channel_id, platform, media_ref, decision, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
    )
    .bind('key_alpha_1', 'org_alpha', 'ch_alpha', 'tiktok', 'https://cdn.example.com/alpha.mp4', 1760000100, 1760086500)
    .run();
  await db
    .prepare(
      `INSERT INTO publish_ledger (idempotency_key, tenant_id, channel_id, platform, media_ref, decision, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
    )
    .bind('key_beta_secret', 'org_beta', 'ch_beta', 'youtube', 'https://cdn.example.com/beta-secret.mp4', 1760000200, 1760086600)
    .run();

  await db
    .prepare('INSERT INTO publishing_jobs (id, tenant_id, provider, status, title, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind('job_alpha_1', 'org_alpha', 'tiktok', 'uploading', 'Alpha Launch Video', 1760000300)
    .run();
  await db
    .prepare('INSERT INTO publishing_jobs (id, tenant_id, provider, status, title, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind('job_beta_secret', 'org_beta', 'youtube', 'live', 'Beta Confidential Campaign', 1760000400)
    .run();

  return db;
}

describe('GET /api/realtime/campaign-stream — Gate G8 Org Isolation', () => {
  let d1: D1Database;

  beforeEach(async () => {
    vi.clearAllMocks();
    d1 = await seedMultiTenantD1();
    mockGetD1.mockResolvedValue(d1);
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/realtime/campaign-stream?once=1');
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
  });

  it('returns 403 when authenticated user of org_alpha requests ?organization_id=org_beta', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user_alpha', email: 'alpha@example.com' });
    const req = new NextRequest(
      'http://localhost/api/realtime/campaign-stream?organization_id=org_beta&once=1',
    );
    const res = await GET(req);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: 'Forbidden: cross-tenant organization_id access denied',
    });
  });

  it('streams 200 text/event-stream snapshot containing ONLY org_alpha rows and zero org_beta rows', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user_alpha', email: 'alpha@example.com' });
    const req = new NextRequest('http://localhost/api/realtime/campaign-stream?once=1');
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream; charset=utf-8');
    expect(res.headers.get('Cache-Control')).toBe('no-cache, no-transform');

    const body = await res.text();
    expect(body).toContain('retry: 3000\n');
    expect(body).toContain('event: snapshot\n');
    expect(body).not.toContain('org_beta');
    expect(body).not.toContain('key_beta_secret');
    expect(body).not.toContain('Beta Confidential Campaign');

    const dataLine = body.split('\n').find((line) => line.startsWith('data: '));
    expect(dataLine).toBeDefined();
    const snapshot = JSON.parse(String(dataLine).slice('data: '.length)) as CampaignStreamSnapshot;
    expect(snapshot.scopedOrgIds).toEqual(['org_alpha']);
    expect(snapshot.pendingApprovals.map((a) => a.idempotencyKey)).toEqual(['key_alpha_1']);
    expect(snapshot.recentJobs.map((j) => j.id)).toEqual(['job_alpha_1']);
  });
});
