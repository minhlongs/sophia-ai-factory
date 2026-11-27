import { describe, expect, it } from 'vitest';
import { POST } from '../route';

describe('POST /api/studio/pipeline/execute (Full 39-Engine Production Wiring)', () => {
  it('executes all 39 registered engines server-side and returns live telemetry', async () => {
    const req = new Request('http://localhost/api/studio/pipeline/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        script: 'Stop losing 40% on fees. #ad #affiliate',
        platform: 'tiktok',
        jurisdiction: 'VN',
        country: 'VN',
        grossUsd: 1000,
        postsToday: 1,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      ok: boolean;
      totalEngines: number;
      results: Array<{ engineId: string; state: string; metricOutput: string }>;
    };
    expect(data.ok).toBe(true);
    expect(data.totalEngines).toBe(39);
    expect(data.results).toHaveLength(39);

    const subId = data.results.find((r) => r.engineId === 'subid-watermark-encoder');
    expect(subId?.state).toBe('passed');
    const recon = data.results.find((r) => r.engineId === 'affiliate-payout-reconciler');
    expect(recon?.state).toBe('passed');
  });

  it('rejects invalid payload with 400', async () => {
    const req = new Request('http://localhost/api/studio/pipeline/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grossUsd: -50 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
