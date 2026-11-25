import { describe, expect, it, vi } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import {
  handlePollHeyGenMp4,
  handleSubmitHeyGenMp4,
  type PilotCommercialDeps,
} from '@/land/first-value/first-value-pilot-heygen';
import { updatePilotMp4ExportStatus } from '@/tree/first-value/pilot-commercial-repo';

interface MockMp4Row {
  id: string;
  org_id: string;
  user_id: string;
  artifact_id: string;
  render_mode: string;
  heygen_job_id: string | null;
  status: 'processing' | 'completed' | 'failed';
  provider_video_url: string | null;
  duration_sec: number | null;
  error_code: string | null;
  cta_text: string;
  short_code: string;
  referral_url: string;
  created_at_iso: string;
  updated_at_iso: string;
}

function createInMemoryD1(initialRow: MockMp4Row): { d1: D1Database; row: MockMp4Row } {
  const row = { ...initialRow };
  const d1 = {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async first() {
              if (sql.includes('FROM pilot_mp4_exports')) {
                return { ...row };
              }
              return null;
            },
            async all() {
              if (sql.includes('FROM pilot_mp4_exports')) {
                return { results: [{ ...row }] };
              }
              return { results: [] };
            },
            async run() {
              if (sql.includes('UPDATE pilot_mp4_exports')) {
                const requiresProcessing = sql.includes("AND status = 'processing'");
                if (!requiresProcessing || row.status === 'processing') {
                  row.status = params[0] as MockMp4Row['status'];
                  if (params[1] != null) row.provider_video_url = String(params[1]);
                  if (params[2] != null) row.duration_sec = Number(params[2]);
                  row.error_code = params[5] != null ? String(params[5]) : null;
                  row.updated_at_iso = String(params[6]);
                }
              }
              return { success: true, meta: { changes: 1 } };
            },
          };
        },
      };
    },
  } as unknown as D1Database;
  return { d1, row };
}

const USER = { id: 'usr_pilot_1', email: 'pilot@example.com' };

describe('Track C: HeyGen Provider Contract & State Machine', () => {
  it('protects terminal completed state from stale processing or failed overwrites', async () => {
    const { d1, row } = createInMemoryD1({
      id: 'pme_1',
      org_id: 'org_1',
      user_id: USER.id,
      artifact_id: 'art_1',
      render_mode: 'heygen_byok_mp4',
      heygen_job_id: 'hg_vid_1',
      status: 'completed',
      provider_video_url: 'https://resource.heygen.ai/video/done.mp4',
      duration_sec: 30,
      error_code: null,
      cta_text: 'Try now',
      short_code: 'abc123',
      referral_url: 'https://sophia.example.com/api/r/abc123',
      created_at_iso: '2026-11-25T10:00:00.000Z',
      updated_at_iso: '2026-11-25T10:01:00.000Z',
    });

    const afterStaleUpdate = await updatePilotMp4ExportStatus(d1, {
      id: 'pme_1',
      orgId: 'org_1',
      userId: USER.id,
      status: 'processing',
      nowIso: '2026-11-25T10:02:00.000Z',
    });
    expect(afterStaleUpdate?.status).toBe('completed');
    expect(row.status).toBe('completed');

    const fetchStatus = vi.fn();
    const submitVideo = vi.fn();
    const res = await handlePollHeyGenMp4(
      d1,
      USER,
      { action: 'poll_heygen_mp4', orgId: 'org_1', exportId: 'pme_1' },
      {
        lookupHeyGenByokKey: async () => 'hg_secret_key_1234567890',
        fetchHeyGenVideoStatus: fetchStatus,
        submitHeyGenVideo: submitVideo,
      },
    );
    expect(res.status).toBe(200);
    expect(fetchStatus).not.toHaveBeenCalled();
    expect(submitVideo).not.toHaveBeenCalled();
  });

  it('sanitizes provider error messages and strips accidental credentials', async () => {
    const { d1 } = createInMemoryD1({
      id: 'pme_2',
      org_id: 'org_1',
      user_id: USER.id,
      artifact_id: 'art_1',
      render_mode: 'heygen_byok_mp4',
      heygen_job_id: 'hg_vid_2',
      status: 'processing',
      provider_video_url: null,
      duration_sec: null,
      error_code: null,
      cta_text: 'Try now',
      short_code: 'abc123',
      referral_url: 'https://sophia.example.com/api/r/abc123',
      created_at_iso: '2026-11-25T10:00:00.000Z',
      updated_at_iso: '2026-11-25T10:00:00.000Z',
    });

    const res = await handlePollHeyGenMp4(
      d1,
      USER,
      { action: 'poll_heygen_mp4', orgId: 'org_1', exportId: 'pme_2' },
      {
        lookupHeyGenByokKey: async () => 'hg_secret_key_1234567890',
        fetchHeyGenVideoStatus: async () => ({
          status: 'failed',
          errorMessage: 'Insufficient credits\nBearer secret_token_xyz sk-live123456789',
        }),
      },
    );
    const body = (await res.json()) as { mp4Export: { status: string; errorCode: string } };
    expect(res.status).toBe(200);
    expect(body.mp4Export.status).toBe('failed');
    expect(body.mp4Export.errorCode).toContain('HEYGEN_RENDER_FAILED:');
    expect(body.mp4Export.errorCode).not.toContain('secret_token_xyz');
    expect(body.mp4Export.errorCode).not.toContain('sk-live123456789');
  });

  it('classifies poll timeout (504), rate-limit (429), and auth rejection (422) without duplicate submit', async () => {
    const makeProcessing = () =>
      createInMemoryD1({
        id: 'pme_3',
        org_id: 'org_1',
        user_id: USER.id,
        artifact_id: 'art_1',
        render_mode: 'heygen_byok_mp4',
        heygen_job_id: 'hg_vid_3',
        status: 'processing',
        provider_video_url: null,
        duration_sec: null,
        error_code: null,
        cta_text: 'Try now',
        short_code: 'abc123',
        referral_url: 'https://sophia.example.com/api/r/abc123',
        created_at_iso: '2026-11-25T10:00:00.000Z',
        updated_at_iso: '2026-11-25T10:00:00.000Z',
      });

    const submitSpy = vi.fn();
    const baseDeps: PilotCommercialDeps = {
      lookupHeyGenByokKey: async () => 'hg_secret_key_1234567890',
      submitHeyGenVideo: submitSpy,
    };

    const timeoutErr = new Error('The operation was aborted due to timeout');
    timeoutErr.name = 'TimeoutError';
    const rTimeout = await handlePollHeyGenMp4(
      makeProcessing().d1,
      USER,
      { action: 'poll_heygen_mp4', orgId: 'org_1', exportId: 'pme_3' },
      { ...baseDeps, fetchHeyGenVideoStatus: async () => { throw timeoutErr; } },
    );
    expect(rTimeout.status).toBe(504);

    const rRate = await handlePollHeyGenMp4(
      makeProcessing().d1,
      USER,
      { action: 'poll_heygen_mp4', orgId: 'org_1', exportId: 'pme_3' },
      { ...baseDeps, fetchHeyGenVideoStatus: async () => { throw new Error('HEYGEN_STATUS_HTTP_429'); } },
    );
    expect(rRate.status).toBe(429);

    const rAuth = await handlePollHeyGenMp4(
      makeProcessing().d1,
      USER,
      { action: 'poll_heygen_mp4', orgId: 'org_1', exportId: 'pme_3' },
      { ...baseDeps, fetchHeyGenVideoStatus: async () => { throw new Error('HEYGEN_STATUS_HTTP_401'); } },
    );
    expect(rAuth.status).toBe(422);
    expect(submitSpy).not.toHaveBeenCalled();
    expect(typeof handleSubmitHeyGenMp4).toBe('function');
  });
});
