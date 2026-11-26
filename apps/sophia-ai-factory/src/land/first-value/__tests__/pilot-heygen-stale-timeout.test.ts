/**
 * @vitest-environment node
 */
import { describe, it, expect, vi } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';

const mockGetExport = vi.fn();
const mockUpdateStatus = vi.fn();

vi.mock('@/tree/first-value/pilot-commercial-repo', () => ({
  getPilotMp4ExportByIdForUser: (...args: unknown[]) => mockGetExport(...args),
  updatePilotMp4ExportStatus: (...args: unknown[]) => mockUpdateStatus(...args),
  getPilotAffiliateLinkByCodeForUser: vi.fn(),
  listPilotMp4Exports: vi.fn(),
  recordPilotMp4Export: vi.fn(),
}));

vi.mock('../first-value-pilot-actions', () => ({
  safeRecordPilotEvent: vi.fn().mockResolvedValue(undefined),
}));

import { handlePollHeyGenMp4 } from '../first-value-pilot-heygen';

describe('handlePollHeyGenMp4 stale 15-minute timeout', () => {
  it('auto-fails HeyGen job stuck in processing >= 15 minutes with HEYGEN_POLL_TIMEOUT_15M_USE_BROWSER_MP4', async () => {
    const createdAtIso = '2026-11-26T00:00:00.000Z';
    const twentyMinutesLaterMs = Date.parse(createdAtIso) + 20 * 60 * 1000;

    mockGetExport.mockResolvedValue({
      id: 'pme_stuck_1',
      orgId: 'org_1',
      userId: 'u_1',
      artifactId: 'art_1',
      heygenJobId: 'hg_job_1',
      status: 'processing',
      createdAtIso,
    });
    mockUpdateStatus.mockResolvedValue({
      id: 'pme_stuck_1',
      status: 'failed',
      errorCode: 'HEYGEN_POLL_TIMEOUT_15M_USE_BROWSER_MP4',
    });

    const res = await handlePollHeyGenMp4(
      {} as D1Database,
      { id: 'u_1', email: 'pilot@example.com' },
      { action: 'poll_heygen_mp4', orgId: 'org_1', exportId: 'pme_stuck_1' },
      {
        nowMs: () => twentyMinutesLaterMs,
        lookupHeyGenByokKey: vi.fn().mockResolvedValue('hg-test-key'),
        fetchHeyGenVideoStatus: vi.fn().mockResolvedValue({ status: 'processing' }),
      },
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as { mp4Export: { status: string; errorCode: string } };
    expect(json.mp4Export.status).toBe('failed');
    expect(json.mp4Export.errorCode).toBe('HEYGEN_POLL_TIMEOUT_15M_USE_BROWSER_MP4');
    expect(mockUpdateStatus).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: 'failed',
        errorCode: 'HEYGEN_POLL_TIMEOUT_15M_USE_BROWSER_MP4',
      }),
    );
  });
});
