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
                const matchesId = params.includes(row.id);
                const matchesOrg = params.includes(row.org_id);
                const matchesUser = params.includes(row.user_id);
                if (matchesId && matchesOrg && matchesUser) {
                  return { ...row };
                }
                return null;
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

describe('HeyGen Provider Contract & State Machine', () => {
  it('protects terminal completed state from stale processing and stale failed overwrites', async () => {
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

    const afterStaleProcessing = await updatePilotMp4ExportStatus(d1, {
      id: 'pme_1',
      orgId: 'org_1',
      userId: USER.id,
      status: 'processing',
      nowIso: '2026-11-25T10:02:00.000Z',
    });
    expect(afterStaleProcessing?.status).toBe('completed');
    expect(row.status).toBe('completed');

    const afterStaleFailure = await updatePilotMp4ExportStatus(d1, {
      id: 'pme_1',
      orgId: 'org_1',
      userId: USER.id,
      status: 'failed',
      errorCode: 'HEYGEN_RENDER_FAILED: stale',
      nowIso: '2026-11-25T10:03:00.000Z',
    });
    expect(afterStaleFailure?.status).toBe('completed');
    expect(row.status).toBe('completed');
    expect(row.error_code).toBeNull();

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

  it('rejects cross-tenant job lookup with 404 without calling provider', async () => {
    const { d1 } = createInMemoryD1({
      id: 'pme_tenant_1',
      org_id: 'org_owner',
      user_id: 'usr_owner',
      artifact_id: 'art_1',
      render_mode: 'heygen_byok_mp4',
      heygen_job_id: 'hg_vid_tenant',
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

    const fetchStatus = vi.fn();
    const res = await handlePollHeyGenMp4(
      d1,
      { id: 'usr_attacker', email: 'attacker@example.com' },
      { action: 'poll_heygen_mp4', orgId: 'org_owner', exportId: 'pme_tenant_1' },
      {
        lookupHeyGenByokKey: async () => 'hg_secret_key_1234567890',
        fetchHeyGenVideoStatus: fetchStatus,
      },
    );
    expect(res.status).toBe(404);
    expect(fetchStatus).not.toHaveBeenCalled();
  });

  it('sanitizes provider error messages and redacts credentials and signed media URLs', async () => {
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
          errorMessage:
            'Render failed\nBearer secret_token_xyz X-Api-Key=mykey999 sk-live123456789 hg_live987654321 apikey=plainkey1 api_key=snakekey2 token=tok3 access_token=acc4 https://cdn.heygen.ai/video.mp4?Signature=abc123&Expires=999999 https://cdn.heygen.ai/v2.mp4%3FSignature%3Denc999%26Expires%3D888',
        }),
      },
    );
    const body = (await res.json()) as { mp4Export: { status: string; errorCode: string } };
    expect(res.status).toBe(200);
    expect(body.mp4Export.status).toBe('failed');
    expect(body.mp4Export.errorCode).toContain('HEYGEN_RENDER_FAILED:');
    expect(body.mp4Export.errorCode).not.toContain('secret_token_xyz');
    expect(body.mp4Export.errorCode).not.toContain('mykey999');
    expect(body.mp4Export.errorCode).not.toContain('sk-live123456789');
    expect(body.mp4Export.errorCode).not.toContain('hg_live987654321');
    expect(body.mp4Export.errorCode).not.toContain('plainkey1');
    expect(body.mp4Export.errorCode).not.toContain('snakekey2');
    expect(body.mp4Export.errorCode).not.toContain('tok3');
    expect(body.mp4Export.errorCode).not.toContain('acc4');
    expect(body.mp4Export.errorCode).not.toContain('Signature=abc123');
    expect(body.mp4Export.errorCode).not.toContain('enc999');
    expect(body.mp4Export.errorCode).toContain('[redacted]');
  });

  it('preserves recoverability across assetPending and 15m local timeout and completes when video_url arrives', async () => {
    const createdAtIso = '2026-11-25T10:00:00.000Z';
    const { d1, row } = createInMemoryD1({
      id: 'pme_recover_1',
      org_id: 'org_1',
      user_id: USER.id,
      artifact_id: 'art_1',
      render_mode: 'heygen_byok_mp4',
      heygen_job_id: 'hg_vid_recover',
      status: 'processing',
      provider_video_url: null,
      duration_sec: null,
      error_code: null,
      cta_text: 'Try now',
      short_code: 'abc123',
      referral_url: 'https://sophia.example.com/api/r/abc123',
      created_at_iso: createdAtIso,
      updated_at_iso: createdAtIso,
    });

    const submitSpy = vi.fn();
    const baseDeps: PilotCommercialDeps = {
      lookupHeyGenByokKey: async () => 'hg_secret_key_1234567890',
      submitHeyGenVideo: submitSpy,
    };

    // 1. Processing < 15m
    const resEarly = await handlePollHeyGenMp4(
      d1,
      USER,
      { action: 'poll_heygen_mp4', orgId: 'org_1', exportId: 'pme_recover_1' },
      {
        ...baseDeps,
        nowMs: () => Date.parse(createdAtIso) + 5 * 60 * 1000,
        fetchHeyGenVideoStatus: async () => ({ status: 'processing' }),
      },
    );
    const bodyEarly = (await resEarly.json()) as { mp4Export: { status: string }; localTimeoutExceeded?: boolean };
    expect(resEarly.status).toBe(200);
    expect(bodyEarly.mp4Export.status).toBe('processing');
    expect(bodyEarly.localTimeoutExceeded).toBeUndefined();
    expect(row.status).toBe('processing');

    // 2. Local timeout >= 15m (16m) stays recoverable in DB
    const res16m = await handlePollHeyGenMp4(
      d1,
      USER,
      { action: 'poll_heygen_mp4', orgId: 'org_1', exportId: 'pme_recover_1' },
      {
        ...baseDeps,
        nowMs: () => Date.parse(createdAtIso) + 16 * 60 * 1000,
        fetchHeyGenVideoStatus: async () => ({ status: 'processing' }),
      },
    );
    const body16m = (await res16m.json()) as {
      mp4Export: { status: string };
      localTimeoutExceeded?: boolean;
      warningCode?: string;
    };
    expect(res16m.status).toBe(200);
    expect(body16m.mp4Export.status).toBe('processing');
    expect(body16m.localTimeoutExceeded).toBe(true);
    expect(body16m.warningCode).toBe('HEYGEN_LOCAL_POLL_TIMEOUT_15M');
    expect(row.status).toBe('processing');

    // 3. Provider completed without video_url (assetPending) stays processing in DB
    const resPending = await handlePollHeyGenMp4(
      d1,
      USER,
      { action: 'poll_heygen_mp4', orgId: 'org_1', exportId: 'pme_recover_1' },
      {
        ...baseDeps,
        nowMs: () => Date.parse(createdAtIso) + 17 * 60 * 1000,
        fetchHeyGenVideoStatus: async () => ({
          status: 'processing',
          assetPending: true,
          warningCode: 'HEYGEN_COMPLETED_ASSET_PENDING',
        }),
      },
    );
    const bodyPending = (await resPending.json()) as {
      mp4Export: { status: string };
      assetPending?: boolean;
      warningCode?: string;
    };
    expect(resPending.status).toBe(200);
    expect(bodyPending.mp4Export.status).toBe('processing');
    expect(bodyPending.assetPending).toBe(true);
    expect(bodyPending.warningCode).toBe('HEYGEN_COMPLETED_ASSET_PENDING');
    expect(row.status).toBe('processing');

    // 4. Subsequent poll at 18m with valid video_url transitions cleanly to completed
    const resDone = await handlePollHeyGenMp4(
      d1,
      USER,
      { action: 'poll_heygen_mp4', orgId: 'org_1', exportId: 'pme_recover_1' },
      {
        ...baseDeps,
        nowMs: () => Date.parse(createdAtIso) + 18 * 60 * 1000,
        fetchHeyGenVideoStatus: async () => ({
          status: 'completed',
          mediaUrl: 'https://resource.heygen.ai/video/final_recovered.mp4',
          durationSec: 28,
        }),
      },
    );
    const bodyDone = (await resDone.json()) as { mp4Export: { status: string; providerVideoUrl: string } };
    expect(resDone.status).toBe(200);
    expect(bodyDone.mp4Export.status).toBe('completed');
    expect(bodyDone.mp4Export.providerVideoUrl).toBe('https://resource.heygen.ai/video/final_recovered.mp4');
    expect(row.status).toBe('completed');
    expect(submitSpy).not.toHaveBeenCalled();
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
