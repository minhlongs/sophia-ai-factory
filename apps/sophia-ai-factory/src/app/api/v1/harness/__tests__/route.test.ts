import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as triggerPOST } from '../trigger/route';
import { GET as pollGET } from '../jobs/poll/route';
import { PATCH as updatePATCH } from '../jobs/[id]/route';
import { GET as statusGET } from '../status/route';
import { getLocalD1Mock } from '@/seed/db/local-d1-mock';

vi.mock('@opennextjs/cloudflare', () => {
  return {
    getCloudflareContext: vi.fn().mockImplementation(async () => {
      return {
        env: {
          EXPERIMENT_KV: {
            get: vi.fn().mockImplementation(async (key: string) => {
              return (globalThis as any).__kvStore?.get(key) ?? null;
            }),
            put: vi.fn().mockImplementation(async (key: string, value: string) => {
              if (!(globalThis as any).__kvStore) {
                (globalThis as any).__kvStore = new Map();
              }
              (globalThis as any).__kvStore.set(key, value);
            }),
          },
        },
      };
    }),
  };
});


const HARNESS_SECRET = 'dev-harness-secret';

function makeRequest(url: string, method: string, body?: unknown, headers: Record<string, string> = {}): NextRequest {
  const options: any = {
    method,
    headers: {
      'x-harness-secret': HARNESS_SECRET,
      'content-type': 'application/json',
      ...headers,
    },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  return new NextRequest(url, options);
}

describe('Harness Engineering API Routes', () => {
  let db: any;

  beforeEach(async () => {
    vi.stubEnv('HARNESS_SECRET', HARNESS_SECRET);
    (globalThis as any).__kvStore = new Map();

    // Override setup.tsx's mock D1 with the actual local sqlite file database
    const realDb = getLocalD1Mock();
    if (!realDb) {
      throw new Error('Local D1 sqlite database mock not available');
    }
    (globalThis as any).__env.DB = realDb;
    db = realDb;

    // Ensure harness tables exist
    await db.exec(`
      CREATE TABLE IF NOT EXISTS harness_jobs (
        id TEXT PRIMARY KEY,
        status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
        triggered_by TEXT CHECK (triggered_by IN ('web', 'telegram', 'scheduler')) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS harness_results (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        test_name TEXT NOT NULL,
        status TEXT CHECK (status IN ('success', 'failed')) NOT NULL,
        duration_ms INTEGER NOT NULL,
        error_message TEXT,
        metadata TEXT,
        FOREIGN KEY (job_id) REFERENCES harness_jobs(id) ON DELETE CASCADE
      );
    `);

    // Clean up existing test runs
    await db.prepare('DELETE FROM harness_jobs').run();
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    (globalThis as any).__kvStore = new Map();
    await db.prepare('DELETE FROM harness_jobs').run();
  });

  it('POST /trigger returns a new job ID and inserts it into DB', async () => {
    const req = makeRequest('http://localhost/api/v1/harness/trigger', 'POST', { triggered_by: 'web' });
    const res = await triggerPOST(req);
    expect(res.status).toBe(200);

    const body = await res.json() as { success: boolean; id: string; status: string };
    expect(body.success).toBe(true);
    expect(body.status).toBe('pending');
    expect(typeof body.id).toBe('string');

    // Verify it exists in D1 database
    const job = (await db.prepare('SELECT id, status, triggered_by FROM harness_jobs WHERE id = ?')
      .bind(body.id)
      .first()) as { id: string; status: string; triggered_by: string } | null;

    expect(job).not.toBeNull();
    expect(job!.status).toBe('pending');
    expect(job!.triggered_by).toBe('web');
  });

  it('GET /jobs/poll fetches the oldest pending job and updates status to processing', async () => {
    // 1. Insert a mock pending job
    const jobId = crypto.randomUUID();
    await db.prepare(
      "INSERT INTO harness_jobs (id, status, triggered_by, created_at, updated_at) VALUES (?, 'pending', 'telegram', datetime('now'), datetime('now'))"
    )
    .bind(jobId)
    .run();

    // 2. Call poll API
    const req = makeRequest('http://localhost/api/v1/harness/jobs/poll', 'GET');
    const res = await pollGET(req);
    expect(res.status).toBe(200);

    const body = await res.json() as { success: boolean; job: { id: string; status: string; triggered_by: string } | null };
    expect(body.success).toBe(true);
    expect(body.job).not.toBeNull();
    expect(body.job?.id).toBe(jobId);
    expect(body.job?.status).toBe('processing');

    // 3. Verify status in database is now processing
    const job = (await db.prepare('SELECT status FROM harness_jobs WHERE id = ?').bind(jobId).first()) as { status: string } | null;
    expect(job!.status).toBe('processing');
  });

  it('PATCH /jobs/[id] updates status to completed and records results', async () => {
    // 1. Insert a processing job
    const jobId = crypto.randomUUID();
    await db.prepare(
      "INSERT INTO harness_jobs (id, status, triggered_by, created_at, updated_at) VALUES (?, 'processing', 'web', datetime('now'), datetime('now'))"
    )
    .bind(jobId)
    .run();

    // 2. Call PATCH update API
    const req = makeRequest(`http://localhost/api/v1/harness/jobs/${jobId}`, 'PATCH', {
      status: 'completed',
      results: [
        { test_name: 'd1_ping', status: 'success', duration_ms: 15 },
        { test_name: 'r2_storage', status: 'success', duration_ms: 45, metadata: { bucket: 'test-bucket' } }
      ]
    });
    const res = await updatePATCH(req, { params: { id: jobId } });
    expect(res.status).toBe(200);

    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);

    // 3. Verify job status updated to completed
    const job = (await db.prepare('SELECT status FROM harness_jobs WHERE id = ?').bind(jobId).first()) as { status: string } | null;
    expect(job!.status).toBe('completed');

    // 4. Verify test results exist in database
    const results = (await db.prepare('SELECT test_name, status, duration_ms, metadata FROM harness_results WHERE job_id = ? ORDER BY test_name ASC')
      .bind(jobId)
      .all()) as { results: { test_name: string; status: string; duration_ms: number; metadata: string }[] };

    expect(results.results.length).toBe(2);
    expect(results.results[0].test_name).toBe('d1_ping');
    expect(results.results[0].status).toBe('success');
    expect(results.results[1].test_name).toBe('r2_storage');
    expect(JSON.parse(results.results[1].metadata).bucket).toBe('test-bucket');
  });

  describe('GET /status', () => {
    it('returns 401 Unauthorized if auth header is missing or incorrect', async () => {
      const req = makeRequest('http://localhost/api/v1/harness/status', 'GET', undefined, {
        'x-harness-secret': 'wrong-secret',
      });
      const res = await statusGET(req);
      expect(res.status).toBe(401);
      const body = await res.json() as { success: boolean; error?: string };
      expect(body.success).toBe(false);
      expect(body.error).toBe('Unauthorized');
    });

    it('returns OFFLINE status when there is no heartbeat in KV', async () => {
      const req = makeRequest('http://localhost/api/v1/harness/status', 'GET');
      const res = await statusGET(req);
      expect(res.status).toBe(200);
      const body = await res.json() as {
        success: boolean;
        daemon: { status: string; last_poll: string | null };
        latestJob: unknown;
      };
      expect(body.success).toBe(true);
      expect(body.daemon.status).toBe('OFFLINE');
      expect(body.daemon.last_poll).toBeNull();
      expect(body.latestJob).toBeNull();
    });

    it('returns ONLINE status when heartbeat is within 30 seconds', async () => {
      const timestamp = new Date().toISOString();
      (globalThis as any).__kvStore.set('harness:daemon_last_poll', timestamp);

      const req = makeRequest('http://localhost/api/v1/harness/status', 'GET');
      const res = await statusGET(req);
      expect(res.status).toBe(200);
      const body = await res.json() as {
        success: boolean;
        daemon: { status: string; last_poll: string | null };
        latestJob: unknown;
      };
      expect(body.success).toBe(true);
      expect(body.daemon.status).toBe('ONLINE');
      expect(body.daemon.last_poll).toBe(timestamp);
    });

    it('returns OFFLINE status when heartbeat is older than 30 seconds', async () => {
      // 40 seconds ago
      const timestamp = new Date(Date.now() - 40000).toISOString();
      (globalThis as any).__kvStore.set('harness:daemon_last_poll', timestamp);

      const req = makeRequest('http://localhost/api/v1/harness/status', 'GET');
      const res = await statusGET(req);
      expect(res.status).toBe(200);
      const body = await res.json() as {
        success: boolean;
        daemon: { status: string; last_poll: string | null };
        latestJob: unknown;
      };
      expect(body.success).toBe(true);
      expect(body.daemon.status).toBe('OFFLINE');
      expect(body.daemon.last_poll).toBe(timestamp);
    });

    it('queries D1 and returns the latest job and its results', async () => {
      const olderJobId = crypto.randomUUID();
      const newerJobId = crypto.randomUUID();

      await db.prepare(
        "INSERT INTO harness_jobs (id, status, triggered_by, created_at, updated_at) VALUES (?, 'completed', 'web', datetime('now', '-1 minute'), datetime('now', '-1 minute'))"
      )
      .bind(olderJobId)
      .run();

      await db.prepare(
        "INSERT INTO harness_jobs (id, status, triggered_by, created_at, updated_at) VALUES (?, 'processing', 'telegram', datetime('now'), datetime('now'))"
      )
      .bind(newerJobId)
      .run();

      await db.prepare(
        "INSERT INTO harness_results (id, job_id, test_name, status, duration_ms, error_message, metadata) VALUES (?, ?, 'd1_ping', 'success', 10, NULL, NULL)"
      )
      .bind(crypto.randomUUID(), newerJobId)
      .run();

      await db.prepare(
        "INSERT INTO harness_results (id, job_id, test_name, status, duration_ms, error_message, metadata) VALUES (?, ?, 'r2_storage', 'failed', 20, 'connection timeout', '{\"bucket\":\"main\"}')"
      )
      .bind(crypto.randomUUID(), newerJobId)
      .run();

      const req = makeRequest('http://localhost/api/v1/harness/status', 'GET');
      const res = await statusGET(req);
      expect(res.status).toBe(200);
      
      const body = await res.json() as {
        success: boolean;
        daemon: { status: string; last_poll: string | null };
        latestJob: {
          id: string;
          status: string;
          triggered_by: string;
          results: Array<{
            test_name: string;
            status: string;
            duration_ms: number;
            error_message: string | null;
            metadata: string | null;
          }>;
        } | null;
      };

      expect(body.success).toBe(true);
      expect(body.latestJob).not.toBeNull();
      expect(body.latestJob?.id).toBe(newerJobId);
      expect(body.latestJob?.status).toBe('processing');
      expect(body.latestJob?.triggered_by).toBe('telegram');
      
      const results = body.latestJob?.results;
      expect(results?.length).toBe(2);
      
      const d1PingResult = results?.find(r => r.test_name === 'd1_ping');
      expect(d1PingResult).toBeDefined();
      expect(d1PingResult?.status).toBe('success');
      expect(d1PingResult?.duration_ms).toBe(10);
      expect(d1PingResult?.error_message).toBeNull();
      
      const r2Result = results?.find(r => r.test_name === 'r2_storage');
      expect(r2Result).toBeDefined();
      expect(r2Result?.status).toBe('failed');
      expect(r2Result?.duration_ms).toBe(20);
      expect(r2Result?.error_message).toBe('connection timeout');
      expect(r2Result?.metadata).toBe('{"bucket":"main"}');
    });
  });
});
