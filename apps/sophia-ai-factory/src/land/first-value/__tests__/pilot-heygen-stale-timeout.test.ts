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

describe('handlePollHeyGenMp4 local 15-minute timeout recoverability', () => {
  it('keeps processing row recoverable at 16 minutes with localTimeoutExceeded warning and completes cleanly at 18 minutes', async () => {
    mockGetExport.mockReset();
    mockUpdateStatus.mockReset();

    const createdAtIso = '2026-11-26T00:00:00.000Z';
    const sixteenMinutesLaterMs = Date.parse(createdAtIso) + 16 * 60 * 1000;
    const eighteenMinutesLaterMs = Date.parse(createdAtIso) + 18 * 60 * 1000;
    const submitSpy = vi.fn();

    mockGetExport.mockResolvedValue({
      id: 'pme_stuck_1',
      orgId: 'org_1',
      userId: 'u_1',
      artifactId: 'art_1',
      heygenJobId: 'hg_job_1',
      status: 'processing',
      createdAtIso,
    });

    const resAt16m = await handlePollHeyGenMp4(
      {} as D1Database,
      { id: 'u_1', email: 'pilot@example.com' },
      { action: 'poll_heygen_mp4', orgId: 'org_1', exportId: 'pme_stuck_1' },
      {
        nowMs: () => sixteenMinutesLaterMs,
        lookupHeyGenByokKey: vi.fn().mockResolvedValue('hg-test-key'),
        fetchHeyGenVideoStatus: vi.fn().mockResolvedValue({ status: 'processing' }),
        submitHeyGenVideo: submitSpy,
      },
    );

    expect(resAt16m.status).toBe(200);
    const json16m = (await resAt16m.json()) as {
      mp4Export: { status: string };
      localTimeoutExceeded?: boolean;
      warningCode?: string;
      publicPublished: boolean;
      paidInferenceExecuted: boolean;
    };
    expect(json16m.mp4Export.status).toBe('processing');
    expect(json16m.localTimeoutExceeded).toBe(true);
    expect(json16m.warningCode).toBe('HEYGEN_LOCAL_POLL_TIMEOUT_15M');
    expect(json16m.publicPublished).toBe(false);
    expect(json16m.paidInferenceExecuted).toBe(false);
    expect(mockUpdateStatus).not.toHaveBeenCalled();
    expect(submitSpy).not.toHaveBeenCalled();

    mockUpdateStatus.mockResolvedValue({
      id: 'pme_stuck_1',
      status: 'completed',
      providerVideoUrl: 'https://resource.heygen.ai/video/recovered_18m.mp4',
      durationSec: 35,
    });

    const resAt18m = await handlePollHeyGenMp4(
      {} as D1Database,
      { id: 'u_1', email: 'pilot@example.com' },
      { action: 'poll_heygen_mp4', orgId: 'org_1', exportId: 'pme_stuck_1' },
      {
        nowMs: () => eighteenMinutesLaterMs,
        lookupHeyGenByokKey: vi.fn().mockResolvedValue('hg-test-key'),
        fetchHeyGenVideoStatus: vi.fn().mockResolvedValue({
          status: 'completed',
          mediaUrl: 'https://resource.heygen.ai/video/recovered_18m.mp4',
          durationSec: 35,
        }),
        submitHeyGenVideo: submitSpy,
      },
    );

    expect(resAt18m.status).toBe(200);
    const json18m = (await resAt18m.json()) as {
      mp4Export: { status: string; providerVideoUrl: string };
      paidInferenceExecuted: boolean;
    };
    expect(json18m.mp4Export.status).toBe('completed');
    expect(json18m.mp4Export.providerVideoUrl).toBe('https://resource.heygen.ai/video/recovered_18m.mp4');
    expect(json18m.paidInferenceExecuted).toBe(false);
    expect(mockUpdateStatus).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: 'completed',
        providerVideoUrl: 'https://resource.heygen.ai/video/recovered_18m.mp4',
      }),
    );
    expect(submitSpy).not.toHaveBeenCalled();
  });
});
