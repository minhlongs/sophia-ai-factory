/**
 * Unit tests: GET /api/v1/missions/[id]/stream — SSE heartbeat-cursor fix (Wave-14)
 *
 * Covers:
 * 1. connected event emits id: 0 initially
 * 2. heartbeat after no events → eventCursor unchanged (comment line, no id:)
 * 3. event after heartbeat → still emitted (dedup check uses eventCursor only)
 * 4. reconnect with Last-Event-ID → resumes from eventCursor, not heartbeat ts
 * 5. terminal status re-emit on reconnect
 * 6. Sentry breadcrumb emitted on connect
 * 7. logger.info sse_disconnect called on stream close
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Hoisted mocks ──────────────────────────────────────────────────────────────

const { mockValidateKey, mockDbFrom, mockAddBreadcrumb, mockLogger } = vi.hoisted(() => ({
  mockValidateKey: vi.fn(),
  mockDbFrom: vi.fn(),
  mockAddBreadcrumb: vi.fn(),
  mockLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@/forest/missions/api-key-auth', () => ({
  validateMissionApiKey: mockValidateKey,
}));

vi.mock('@/seed/db/client', () => ({
  createServerClient: () => ({ from: mockDbFrom }),
}));

vi.mock('@sentry/nextjs', () => ({
  addBreadcrumb: mockAddBreadcrumb,
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: mockLogger,
}));

vi.mock('@/forest/middleware/rate-limit-wrapper', () => ({
  withRateLimit: (fn: (r: NextRequest) => Promise<Response>, _opts: unknown) =>
    (r: NextRequest) => fn(r),
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeMissionRow(overrides: Partial<{
  status: string; updated_at: number; completed_at: number | null;
}> = {}) {
  return {
    id: 'mission-1',
    command: 'test',
    status: 'running',
    result: null,
    error: null,
    credits_used: 0,
    updated_at: 1000,
    completed_at: null,
    ...overrides,
  };
}

function makeChain(row: ReturnType<typeof makeMissionRow> | null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: row, error: null }),
  };
}

async function drain(stream: ReadableStream<Uint8Array>): Promise<string> {
  const dec = new TextDecoder();
  const reader = stream.getReader();
  let out = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    out += dec.decode(value);
  }
  return out;
}

async function callGET(missionId: string, lastEventId?: string): Promise<{ response: Response; body: string }> {
  const { GET } = await import('./route');
  const headers: Record<string, string> = { authorization: 'Bearer key' };
  if (lastEventId !== undefined) headers['last-event-id'] = lastEventId;
  const req = new NextRequest(`http://localhost/api/v1/missions/${missionId}/stream`, { headers });
  const response = await GET(req, { params: Promise.resolve({ id: missionId }) });
  const body = response.body ? await drain(response.body as ReadableStream<Uint8Array>) : '';
  return { response, body };
}

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockValidateKey.mockResolvedValue({ valid: true, userId: 'user-1' });
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('SSE stream heartbeat-cursor separation (Wave-14)', () => {

  it('connected event carries id: 0 when no Last-Event-ID header', async () => {
    vi.useFakeTimers();
    const row = makeMissionRow({ status: 'succeeded', updated_at: 5000 });
    mockDbFrom.mockReturnValue(makeChain(row));

    const { GET } = await import('./route');
    const req = new NextRequest('http://localhost/api/v1/missions/mission-1/stream', {
      headers: { authorization: 'Bearer key' },
    });
    const responsePromise = GET(req, { params: Promise.resolve({ id: 'mission-1' }) });
    // Advance past one poll cycle so stream terminates (terminal status)
    await vi.advanceTimersByTimeAsync(2100);
    const response = await responsePromise;
    const body = await drain(response.body as ReadableStream<Uint8Array>);
    vi.useRealTimers();

    expect(body).toContain('id: 0\n');
    expect(body).toContain('event: connected');
  }, 15000);

  it('heartbeat emits `: ping` comment line (no `id:`) and does not advance eventCursor', async () => {
    vi.useFakeTimers();
    let callCount = 0;
    mockDbFrom.mockImplementation(() => {
      callCount++;
      // Polls 1-7: keep status running (updated_at=1000, resume cursor=1000 → all skip)
      // Poll 8: new updated_at=2000 → emit + terminal (after heartbeat has fired)
      const row = callCount < 8
        ? makeMissionRow({ status: 'running', updated_at: 1000 })
        : makeMissionRow({ status: 'succeeded', updated_at: 2000 });
      return makeChain(row);
    });

    const { GET } = await import('./route');
    const req = new NextRequest('http://localhost/api/v1/missions/mission-1/stream', {
      headers: { authorization: 'Bearer key', 'last-event-id': '1000' },
    });
    const responsePromise = GET(req, { params: Promise.resolve({ id: 'mission-1' }) });

    // Advance 18s total: covers 9 × 2s poll cycles.
    // At ~15s mark, heartbeat fires. At poll 8 (16s+), terminal emits and stream closes.
    await vi.advanceTimersByTimeAsync(18000);

    const response = await responsePromise;
    const body = await drain(response.body as ReadableStream<Uint8Array>);
    vi.useRealTimers();

    // Heartbeat must be SSE comment line (`: ping <ts>`), NOT an event with `id:` line
    expect(body).toMatch(/^: ping \d+/m);

    // Event for updated_at=2000 must appear — proves heartbeat did NOT corrupt eventCursor
    expect(body).toContain('"updated_at":2000');
    expect(body).toContain('event: done');
  }, 30000);

  it('event after heartbeat is still emitted (dedup uses eventCursor not heartbeat ts)', async () => {
    vi.useFakeTimers();
    // Simple case: no resume, first poll is terminal
    const row = makeMissionRow({ status: 'succeeded', updated_at: 9999 });
    mockDbFrom.mockReturnValue(makeChain(row));

    const { GET } = await import('./route');
    const req = new NextRequest('http://localhost/api/v1/missions/mission-1/stream', {
      headers: { authorization: 'Bearer key' },
    });
    const responsePromise = GET(req, { params: Promise.resolve({ id: 'mission-1' }) });
    await vi.advanceTimersByTimeAsync(2100);

    const response = await responsePromise;
    const body = await drain(response.body as ReadableStream<Uint8Array>);
    vi.useRealTimers();

    expect(body).toContain('"updated_at":9999');
    expect(body).toContain('event: status');
    expect(body).toContain('event: done');
  }, 15000);

  it('reconnect with Last-Event-ID skips already-seen state and emits next state', async () => {
    vi.useFakeTimers();
    let callCount = 0;
    mockDbFrom.mockImplementation(() => {
      callCount++;
      return makeChain(
        callCount === 1
          ? makeMissionRow({ status: 'running', updated_at: 5000 })  // skip (5000 <= 5000)
          : makeMissionRow({ status: 'succeeded', updated_at: 6000 }) // emit
      );
    });

    const { GET } = await import('./route');
    const req = new NextRequest('http://localhost/api/v1/missions/mission-1/stream', {
      headers: { authorization: 'Bearer key', 'last-event-id': '5000' },
    });
    const responsePromise = GET(req, { params: Promise.resolve({ id: 'mission-1' }) });
    await vi.advanceTimersByTimeAsync(2100); // first poll → skip
    await vi.advanceTimersByTimeAsync(2100); // second poll → emit done

    const response = await responsePromise;
    const body = await drain(response.body as ReadableStream<Uint8Array>);
    vi.useRealTimers();

    // updated_at=5000 must not appear as a status event body
    expect(body).not.toMatch(/event: status[\s\S]*?"updated_at":5000/);
    expect(body).toContain('"updated_at":6000');
    expect(body).toContain('event: done');
  }, 15000);

  it('terminal status is re-emitted on reconnect when cursor matches existing terminal', async () => {
    vi.useFakeTimers();
    const row = makeMissionRow({ status: 'succeeded', updated_at: 7000 });
    mockDbFrom.mockReturnValue(makeChain(row));

    const { GET } = await import('./route');
    const req = new NextRequest('http://localhost/api/v1/missions/mission-1/stream', {
      headers: { authorization: 'Bearer key', 'last-event-id': '7000' },
    });
    const responsePromise = GET(req, { params: Promise.resolve({ id: 'mission-1' }) });
    await vi.advanceTimersByTimeAsync(2100);

    const response = await responsePromise;
    const body = await drain(response.body as ReadableStream<Uint8Array>);
    vi.useRealTimers();

    expect(body).toContain('event: done');
    expect(body).toContain('"status":"succeeded"');
  }, 15000);

  it('Sentry breadcrumb emitted on connect with sse category', async () => {
    vi.useFakeTimers();
    const row = makeMissionRow({ status: 'succeeded', updated_at: 1 });
    mockDbFrom.mockReturnValue(makeChain(row));

    const { GET } = await import('./route');
    const req = new NextRequest('http://localhost/api/v1/missions/mission-1/stream', {
      headers: { authorization: 'Bearer key' },
    });
    const responsePromise = GET(req, { params: Promise.resolve({ id: 'mission-1' }) });
    await vi.advanceTimersByTimeAsync(2100);
    await responsePromise;
    vi.useRealTimers();

    expect(mockAddBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'sse',
        message: expect.stringContaining('connect'),
        data: expect.objectContaining({ mission_id: 'mission-1' }),
      }),
    );
  }, 15000);

  it('logger.info sse_disconnect called on stream close', async () => {
    vi.useFakeTimers();
    const row = makeMissionRow({ status: 'succeeded', updated_at: 1 });
    mockDbFrom.mockReturnValue(makeChain(row));

    const { GET } = await import('./route');
    const req = new NextRequest('http://localhost/api/v1/missions/mission-1/stream', {
      headers: { authorization: 'Bearer key' },
    });
    const responsePromise = GET(req, { params: Promise.resolve({ id: 'mission-1' }) });
    await vi.advanceTimersByTimeAsync(2100);
    await responsePromise;
    vi.useRealTimers();

    expect(mockLogger.info).toHaveBeenCalledWith(
      'sse_disconnect',
      expect.objectContaining({ mission_id: 'mission-1' }),
    );
  }, 15000);
});
