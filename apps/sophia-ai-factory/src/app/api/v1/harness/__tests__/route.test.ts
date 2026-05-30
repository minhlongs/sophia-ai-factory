import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as triggerPOST } from '../trigger/route';
import { GET as pollGET } from '../jobs/poll/route';
import { PATCH as updatePATCH } from '../jobs/[id]/route';
import { getLocalD1Mock } from '@/seed/db/local-d1-mock';

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
    
    // Override setup.tsx's mock D1 with the actual local sqlite file database
    const realDb = getLocalD1Mock();
    if (!realDb) {
      throw new Error('Local D1 sqlite database mock not available');
    }
    (globalThis as any).__env.DB = realDb;
    db = realDb;

    // Clean up existing test runs
    await db.prepare('DELETE FROM harness_jobs').run();
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
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
});
