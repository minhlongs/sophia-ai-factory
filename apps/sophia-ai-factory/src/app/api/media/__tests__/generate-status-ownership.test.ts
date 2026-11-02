/**
 * POST /api/media/generate → GET /api/media/status round trip.
 *
 * GET /api/media/status authorizes polling from the D1 `media_jobs` row alone,
 * so a generate call whose insert silently failed would lock the real job owner
 * out permanently with 403. This suite runs against the schema as migrated
 * (migration 0139 plus the later ALTERs), where `type` is NOT NULL with no
 * default — a missing column makes INSERT OR IGNORE insert zero rows and throw
 * nothing, which is exactly the failure a hand-rolled mock cannot see.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { freshDb, makeD1 } from '@/__tests__/integration/shared-d1-shim';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getD1: vi.fn(),
  submitMediaJob: vi.fn(),
  getJobStatus: vi.fn(),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock('@/seed/db/client', () => ({ createServerClient: vi.fn(), getD1: mocks.getD1 }));
vi.mock('@/seed/db/resolve-user-tier', () => ({ resolveUserTier: vi.fn().mockResolvedValue('PREMIUM') }));
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/tree/clients/muapi-media-client', () => ({
  submitMediaJob: mocks.submitMediaJob,
  getJobStatus: mocks.getJobStatus,
  isModelSupported: (type: string, model: string) =>
    (type === 'video' && model === 'kling-3.0') || (type === 'audio' && model === 'suno-v4'),
  SUPPORTED_MODELS: {
    image: ['flux-schnell'],
    video: ['kling-3.0'],
    audio: ['suno-v4'],
  },
}));

import { POST as submitGenerate } from '@/app/api/media/generate/route';
import { GET as readStatus } from '@/app/api/media/status/route';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS media_jobs (
  id            TEXT    PRIMARY KEY,
  user_id       TEXT    NOT NULL,
  type          TEXT    NOT NULL CHECK(type IN ('image', 'video', 'audio')),
  model         TEXT    NOT NULL,
  prompt        TEXT,
  status        TEXT    NOT NULL DEFAULT 'pending',
  result_url    TEXT,
  thumbnail_url TEXT,
  error         TEXT,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  completed_at  INTEGER,
  storage_key   TEXT,
  bucket        TEXT,
  provider_cost     INTEGER,
  cost_currency     TEXT,
  cost_classification TEXT,
  revenue_attribution INTEGER,
  gross_margin       INTEGER,
  error_category    TEXT,
  retry_count      INTEGER,
  requested_at      INTEGER,
  started_at        INTEGER,
  latency_ms INTEGER
);
CREATE INDEX IF NOT EXISTS idx_media_jobs_user_type
  ON media_jobs(user_id, type, created_at DESC);`;

const USER = { id: 'user-1', email: 'owner@example.com' } as never;
const STRANGER = { id: 'user-2', email: 'stranger@example.com' } as never;

function setupDb(): ReturnType<typeof freshDb> {
  const raw = freshDb();
  raw.exec(SCHEMA);
  mocks.getD1.mockResolvedValue(makeD1(raw));
  return raw;
}

function generateRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/media/generate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function statusRequest(jobId: string): NextRequest {
  return new NextRequest(`http://localhost/api/media/status?id=${jobId}`);
}

describe('POST /api/media/generate records an owner-readable media_jobs row', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('MUAPI_API_KEY', 'muapi_test_key');
    mocks.getCurrentUser.mockResolvedValue(USER);
  });

  it('persists every NOT NULL column so status polling finds the ownership row', async () => {
    const raw = setupDb();
    mocks.submitMediaJob.mockResolvedValue({
      success: true,
      job: { id: 'job_v1', status: 'pending', type: 'video', model: 'kling-3.0' },
    });

    const res = await submitGenerate(
      generateRequest({ type: 'video', model: 'kling-3.0', prompt: 'A wave', duration: 5 }),
    );

    expect(res.status).toBe(200);
    const row = raw.prepare('SELECT * FROM media_jobs WHERE id = ?').get('job_v1') as
      | Record<string, unknown>
      | undefined;
    expect(row).toBeDefined();
    expect(row!.user_id).toBe('user-1');
    expect(row!.type).toBe('video');
    expect(row!.model).toBe('kling-3.0');
    expect(row!.prompt).toBe('A wave');
    expect(row!.status).toBe('pending');
    expect(typeof row!.created_at).toBe('number');
    expect(row!.created_at).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
  });

  it('lets the submitting owner poll their own job (200, not a 403)', async () => {
    setupDb();
    mocks.submitMediaJob.mockResolvedValue({
      success: true,
      job: { id: 'job_own', status: 'pending', type: 'video', model: 'kling-3.0' },
    });
    mocks.getJobStatus.mockResolvedValue({
      success: true,
      job: { id: 'job_own', status: 'completed', type: 'video', model: 'kling-3.0', resultUrl: 'https://cdn.example/a.mp4' },
    });

    expect((await submitGenerate(
      generateRequest({ type: 'video', model: 'kling-3.0', prompt: 'A wave' }),
    )).status).toBe(200);

    const res = await readStatus(statusRequest('job_own'));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { status: string }).status).toBe('completed');
  });

  it('still refuses a second user polling the same job (403)', async () => {
    setupDb();
    mocks.submitMediaJob.mockResolvedValue({
      success: true,
      job: { id: 'job_shared', status: 'pending', type: 'video', model: 'kling-3.0' },
    });
    mocks.getJobStatus.mockResolvedValue({
      success: true,
      job: { id: 'job_shared', status: 'completed', type: 'video', model: 'kling-3.0' },
    });

    await submitGenerate(generateRequest({ type: 'video', model: 'kling-3.0', prompt: 'A wave' }));
    mocks.getCurrentUser.mockResolvedValue(STRANGER);

    const res = await readStatus(statusRequest('job_shared'));
    expect(res.status).toBe(403);
    expect(mocks.getJobStatus).not.toHaveBeenCalled();
  });

  it('records audio jobs with an audio type so the CHECK constraint accepts them', async () => {
    const raw = setupDb();
    mocks.submitMediaJob.mockResolvedValue({
      success: true,
      job: { id: 'job_a1', status: 'pending', type: 'audio', model: 'suno-v4' },
    });

    expect((await submitGenerate(
      generateRequest({ type: 'audio', model: 'suno-v4', prompt: 'A calm song' }),
    )).status).toBe(200);

    const row = raw.prepare('SELECT type FROM media_jobs WHERE id = ?').get('job_a1') as
      | { type: string }
      | undefined;
    expect(row!.type).toBe('audio');
  });
});
