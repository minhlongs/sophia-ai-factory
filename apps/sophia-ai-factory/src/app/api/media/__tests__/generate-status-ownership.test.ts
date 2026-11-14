/**
 * POST /api/media/generate → GET /api/media/status round trip.
 *
 * Verifies against real SQLite (`shared-d1-shim`):
 * - `POST /api/media/generate` persists `provider = 'muapi'` and
 *   `cost_classification = 'UNMETERED'` using the caller's `'muapi'` BYOK key.
 * - `GET /api/media/status` enforces strict `WHERE id = ?1 AND user_id = ?2`
 *   ownership (403 for unowned/missing jobs), polls in-flight jobs with the
 *   caller's BYOK key, writes back terminal status/URLs/errors to D1, and
 *   serves subsequent polls from cached D1 state without hitting MuAPI again.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { freshDb, makeD1 } from '@/__tests__/integration/shared-d1-shim';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getD1: vi.fn(),
  resolveUserApiKey: vi.fn(),
  submitMediaJob: vi.fn(),
  getJobStatus: vi.fn(),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock('@/seed/db/client', () => ({ createServerClient: vi.fn(), getD1: mocks.getD1 }));
vi.mock('@/seed/db/resolve-user-tier', () => ({ resolveUserTier: vi.fn().mockResolvedValue('PREMIUM') }));
vi.mock('@/tree/byok/resolve-user-api-key', () => ({ resolveUserApiKey: mocks.resolveUserApiKey }));
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
  provider      TEXT,
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

describe('POST /api/media/generate → GET /api/media/status BYOK & ownership round trip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('MUAPI_API_KEY', 'operator_platform_secret_key');
    mocks.getCurrentUser.mockResolvedValue(USER);
    mocks.resolveUserApiKey.mockResolvedValue('customer_byok_muapi_key');
  });

  it('persists provider = muapi, cost_classification = UNMETERED, and every NOT NULL column', async () => {
    const raw = setupDb();
    mocks.submitMediaJob.mockResolvedValue({
      success: true,
      job: { id: 'job_v1', status: 'pending', type: 'video', model: 'kling-3.0' },
    });

    const res = await submitGenerate(
      generateRequest({ type: 'video', model: 'kling-3.0', prompt: 'A wave', duration: 5 }),
    );

    expect(res.status).toBe(200);
    expect(mocks.submitMediaJob).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'video', model: 'kling-3.0', prompt: 'A wave', duration: 5 }),
      { fund: 'byok', apiKey: 'customer_byok_muapi_key' },
    );

    const row = raw.prepare('SELECT * FROM media_jobs WHERE id = ?').get('job_v1') as
      | Record<string, unknown>
      | undefined;
    expect(row).toBeDefined();
    expect(row!.user_id).toBe('user-1');
    expect(row!.type).toBe('video');
    expect(row!.model).toBe('kling-3.0');
    expect(row!.prompt).toBe('A wave');
    expect(row!.status).toBe('pending');
    expect(row!.provider).toBe('muapi');
    expect(row!.cost_classification).toBe('UNMETERED');
    expect(typeof row!.created_at).toBe('number');
    expect(row!.created_at).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
  });

  it('polls MuAPI with customer BYOK key, writes back terminal status to D1, and serves repeat polls from cache', async () => {
    const raw = setupDb();
    mocks.submitMediaJob.mockResolvedValue({
      success: true,
      job: { id: 'job_own', status: 'pending', type: 'video', model: 'kling-3.0' },
    });
    mocks.getJobStatus.mockResolvedValue({
      success: true,
      job: {
        id: 'job_own',
        status: 'completed',
        type: 'video',
        model: 'kling-3.0',
        resultUrl: 'https://cdn.example/a.mp4',
        thumbnailUrl: 'https://cdn.example/t.jpg',
        createdAt: '2026-11-14T00:00:00.000Z',
        completedAt: '2026-11-14T00:00:10.000Z',
      },
    });

    expect((await submitGenerate(
      generateRequest({ type: 'video', model: 'kling-3.0', prompt: 'A wave' }),
    )).status).toBe(200);

    // First poll: refreshes from MuAPI using customer BYOK key and writes back to D1
    const firstPoll = await readStatus(statusRequest('job_own'));
    expect(firstPoll.status).toBe(200);
    const firstBody = (await firstPoll.json()) as { status: string; resultUrl: string };
    expect(firstBody.status).toBe('completed');
    expect(firstBody.resultUrl).toBe('https://cdn.example/a.mp4');
    expect(mocks.getJobStatus).toHaveBeenCalledTimes(1);
    expect(mocks.getJobStatus).toHaveBeenCalledWith('job_own', {
      fund: 'byok',
      apiKey: 'customer_byok_muapi_key',
    });

    const persisted = raw.prepare('SELECT status, result_url, thumbnail_url, completed_at FROM media_jobs WHERE id = ?').get('job_own') as {
      status: string;
      result_url: string | null;
      thumbnail_url: string | null;
      completed_at: number | null;
    };
    expect(persisted.status).toBe('completed');
    expect(persisted.result_url).toBe('https://cdn.example/a.mp4');
    expect(persisted.thumbnail_url).toBe('https://cdn.example/t.jpg');
    expect(typeof persisted.completed_at).toBe('number');

    // Second poll: job is now terminal in D1 — returns cached row even without BYOK or MuAPI call
    mocks.resolveUserApiKey.mockClear();
    mocks.getJobStatus.mockClear();
    mocks.resolveUserApiKey.mockResolvedValue(null);

    const cachedPoll = await readStatus(statusRequest('job_own'));
    expect(cachedPoll.status).toBe(200);
    const cachedBody = (await cachedPoll.json()) as { status: string; resultUrl: string; thumbnailUrl: string };
    expect(cachedBody.status).toBe('completed');
    expect(cachedBody.resultUrl).toBe('https://cdn.example/a.mp4');
    expect(cachedBody.thumbnailUrl).toBe('https://cdn.example/t.jpg');
    expect(mocks.resolveUserApiKey).not.toHaveBeenCalled();
    expect(mocks.getJobStatus).not.toHaveBeenCalled();
  });

  it('refuses in-flight status polling with 422 NO_API_KEY when customer BYOK key was removed, without using MUAPI_API_KEY', async () => {
    setupDb();
    mocks.submitMediaJob.mockResolvedValue({
      success: true,
      job: { id: 'job_pending', status: 'pending', type: 'video', model: 'kling-3.0' },
    });

    expect((await submitGenerate(
      generateRequest({ type: 'video', model: 'kling-3.0', prompt: 'A wave' }),
    )).status).toBe(200);

    mocks.resolveUserApiKey.mockResolvedValueOnce(null);

    const res = await readStatus(statusRequest('job_pending'));
    const body = (await res.json()) as { code: string };
    expect(res.status).toBe(422);
    expect(body.code).toBe('NO_API_KEY');
    expect(mocks.getJobStatus).not.toHaveBeenCalled();
  });

  it('still refuses a second user polling the same job (403) without touching BYOK or MuAPI', async () => {
    setupDb();
    mocks.submitMediaJob.mockResolvedValue({
      success: true,
      job: { id: 'job_shared', status: 'pending', type: 'video', model: 'kling-3.0' },
    });

    await submitGenerate(generateRequest({ type: 'video', model: 'kling-3.0', prompt: 'A wave' }));
    mocks.resolveUserApiKey.mockClear();
    mocks.getCurrentUser.mockResolvedValue(STRANGER);

    const res = await readStatus(statusRequest('job_shared'));
    expect(res.status).toBe(403);
    expect(mocks.resolveUserApiKey).not.toHaveBeenCalled();
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

    const row = raw.prepare('SELECT type, provider, cost_classification FROM media_jobs WHERE id = ?').get('job_a1') as
      | { type: string; provider: string; cost_classification: string }
      | undefined;
    expect(row!.type).toBe('audio');
    expect(row!.provider).toBe('muapi');
    expect(row!.cost_classification).toBe('UNMETERED');
  });

  it('prevents an out-of-order stale processing poll from clobbering a completed D1 row or wiping result_url', async () => {
    const raw = setupDb();
    mocks.submitMediaJob.mockResolvedValue({
      success: true,
      job: { id: 'job_race', status: 'processing', type: 'video', model: 'kling-3.0' },
    });

    expect(
      (await submitGenerate(generateRequest({ type: 'video', model: 'kling-3.0', prompt: 'A wave' }))).status,
    ).toBe(200);

    let releaseStalePoll!: () => void;
    const staleGate = new Promise<void>((resolve) => {
      releaseStalePoll = resolve;
    });

    mocks.getJobStatus
      .mockImplementationOnce(async () => {
        await staleGate;
        return {
          success: true,
          job: {
            id: 'job_race',
            status: 'processing',
            type: 'video',
            model: 'kling-3.0',
            createdAt: '2026-11-14T00:00:00.000Z',
          },
        };
      })
      .mockResolvedValueOnce({
        success: true,
        job: {
          id: 'job_race',
          status: 'completed',
          type: 'video',
          model: 'kling-3.0',
          resultUrl: 'https://cdn.example/final.mp4',
          thumbnailUrl: 'https://cdn.example/final.jpg',
          createdAt: '2026-11-14T00:00:00.000Z',
          completedAt: '2026-11-14T00:00:05.000Z',
        },
      });

    // Poll A starts while row is 'processing', then Poll B completes and writes 'completed' first
    const pollAPromise = readStatus(statusRequest('job_race'));
    await new Promise((r) => setTimeout(r, 10));
    const pollBRes = await readStatus(statusRequest('job_race'));
    expect(pollBRes.status).toBe(200);

    // Release slower Poll A returning stale 'processing' with undefined resultUrl
    releaseStalePoll();
    const pollARes = await pollAPromise;
    expect(pollARes.status).toBe(200);

    const row = raw
      .prepare('SELECT status, result_url, thumbnail_url, completed_at FROM media_jobs WHERE id = ?')
      .get('job_race') as {
      status: string;
      result_url: string | null;
      thumbnail_url: string | null;
      completed_at: number | null;
    };
    expect(row.status).toBe('completed');
    expect(row.result_url).toBe('https://cdn.example/final.mp4');
    expect(row.thumbnail_url).toBe('https://cdn.example/final.jpg');
    expect(typeof row.completed_at).toBe('number');
  });

  it('rejects path-traversal or malformed job ids on GET /api/media/status with 400 before touching D1 or MuAPI', async () => {
    setupDb();
    const res = await readStatus(
      new NextRequest('http://localhost/api/media/status?id=../account'),
    );
    expect(res.status).toBe(400);
    expect(mocks.getJobStatus).not.toHaveBeenCalled();
  });
});
