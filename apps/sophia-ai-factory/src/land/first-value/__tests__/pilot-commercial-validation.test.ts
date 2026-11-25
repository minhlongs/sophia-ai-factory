// @vitest-environment node
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import { NodeSqliteD1Database } from '@/seed/db/node-sqlite-d1';
import { enforcePilotFeatureDisabled } from '@/seed/pilot/pilot-auth-guard';
import { isPublicApiRoute } from '@/forest/middleware/guard/public-routes';
import {
  hashPilotVisitorIp,
  resolveAffiliateSubIdParam,
  resolveAndRecordPilotShortlinkClick,
} from '@/tree/first-value/pilot-commercial-repo';
import { GET as handleShortlinkGet } from '@/app/api/r/[code]/route';
import {
  assertSafeHeyGenMediaUrl,
  fetchPilotHeyGenByokStatus,
  submitPilotHeyGenByokVideo,
} from '../pilot-heygen-byok-client';
import {
  handleFirstValueGet,
  handleFirstValuePost,
  type FirstValueHttpDeps,
} from '../first-value-http-handler';
import {
  classifyPilotP0P1Findings,
  collectLivePilotOpsSnapshot,
  redactSensitiveText,
} from '../../../../scripts/pilot-ops-report.mjs';
import {
  evaluatePilotDecisionAgainstResearch,
  formatDecisionMarkdown,
} from '../../../../scripts/pilot-decision-report.mjs';

function makeJsonPost(body: Record<string, unknown>, idempotencyKey?: string): NextRequest {
  return new NextRequest('https://sophia-ai-factory-pilot.agencyos-openclaw.workers.dev/api/first-value', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe('Customer Pilot Commercial Validation E2E (CUSTOMER_BYOK, MP4, Shortlink, Ops & REPORT 10/12)', () => {
  it('opens /api/r/[code] publicly on pilot while keeping payments, auto-publish, and non-pilot APIs blocked', () => {
    const pilotEnv = {
      PILOT_INVITE_ONLY: 'true',
      PAYMENTS_ENABLED: 'false',
      B2_PUBLISH_ENABLED: 'false',
    };
    expect(enforcePilotFeatureDisabled('/api/r/abcdefghij', pilotEnv)).toBeNull();
    expect(isPublicApiRoute('/api/r/abcdefghij')).toBe(true);

    expect(enforcePilotFeatureDisabled('/api/checkout/session', pilotEnv)?.status).toBe(403);
    expect(enforcePilotFeatureDisabled('/api/publish/tiktok', pilotEnv)?.status).toBe(403);
    expect(enforcePilotFeatureDisabled('/api/videos/generate', pilotEnv)?.status).toBe(403);
  });

  it('completes BYOK -> Script -> Accept -> Shortlink -> 302 Click -> Browser & HeyGen MP4 -> Manual Publish -> Ops & Decision Verdict', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sophia-pilot-e2e-'));
    try {
      const sqlite = new NodeSqliteD1Database(path.join(tmpDir, 'pilot.sqlite'));
      for (const mig of [
        '0515_first_value_reviews.sql',
        '0517_customer_pilot_first_value.sql',
        '0519_pilot_support_requests.sql',
        '0520_pilot_commercial_validation.sql',
      ]) {
        const sql = fs.readFileSync(
          path.resolve(__dirname, '../../../../migrations', mig),
          'utf8',
        );
        await sqlite.exec(sql);
      }

      const d1 = sqlite as unknown as D1Database;
      const storedKeys = new Map<string, string>();

      const pilotEnv = {
        PILOT_INVITE_ONLY: 'true',
        PILOT_ALLOWED_EMAILS: 'ceo@customer.vn',
        PILOT_LIVE_INFERENCE_ENABLED: 'true',
        PILOT_FINANCING_MODE: 'CUSTOMER_BYOK',
        PILOT_MAX_GENERATIONS: '20',
        PILOT_MAX_ESTIMATED_SPEND_USD: '4.00',
        PILOT_ESTIMATED_COST_PER_ATTEMPT_USD: '0.02',
        PILOT_MODEL_ID: 'openai/gpt-4o-mini',
        PILOT_MAX_OUTPUT_TOKENS: '2048',
        PILOT_MAX_RETRIES: '1',
        PILOT_TIMEOUT_MS: '45000',
        PAYMENTS_ENABLED: 'false',
        B2_PUBLISH_ENABLED: 'false',
        APP_URL: 'https://sophia-ai-factory-pilot.agencyos-openclaw.workers.dev',
      };

      const deps: FirstValueHttpDeps = {
        getD1: async () => d1,
        getCurrentUser: async () => ({ id: 'usr_ceo_1', email: 'ceo@customer.vn' }),
        verifyWorkspaceAccess: async (orgId) => orgId === 'org_ceo_1',
        verifyCsrf: () => true,
        listByokProviders: async () => Array.from(storedKeys.keys()),
        signingSecret: 'pilot-signing-secret-at-least-32-chars',
        pilotEnv,
        lookupOpenRouterByokKey: async () => storedKeys.get('openrouter') ?? null,
        probeOpenRouterByokKey: async () => ({
          ok: true,
          valid: true,
          provider: 'openrouter',
          status: 'ACTIVE',
          latencyMs: 42,
          message: 'Verified',
          message_vi: 'Đã xác thực',
          maskedKey: 'sk-or-****9999',
        }),
        saveOpenRouterByokKey: async (_uid, key) => {
          storedKeys.set('openrouter', key);
        },
        clearOpenRouterByokKey: async () => {
          storedKeys.delete('openrouter');
        },
        lookupHeyGenByokKey: async () => storedKeys.get('heygen') ?? null,
        probeHeyGenByokKey: async () => ({
          ok: true,
          valid: true,
          provider: 'heygen',
          status: 'ACTIVE',
          latencyMs: 55,
          message: 'HeyGen verified',
          message_vi: 'Đã xác thực HeyGen',
          maskedKey: 'hg_****1234',
        }),
        saveHeyGenByokKey: async (_uid, key) => {
          storedKeys.set('heygen', key);
        },
        clearHeyGenByokKey: async () => {
          storedKeys.delete('heygen');
        },
        submitHeyGenVideo: async () => ({ videoId: 'hg_job_001' }),
        fetchHeyGenVideoStatus: async () => ({
          status: 'completed',
          mediaUrl: 'https://files2.heygen.ai/pilot/video-001.mp4',
          durationSec: 28.5,
        }),
        generateLiveScript: async ({ topic }) => ({
          title: `Chiến dịch: ${topic}`,
          total_duration: 30,
          scenes: [
            {
              scene_number: 1,
              title: 'Mở đầu gây chú ý',
              visual_description: 'Cảnh phòng khám đông khách',
              narration: 'Bạn có đang mất 40% khách tái khám mỗi tháng?',
              duration_estimate: 10,
            },
            {
              scene_number: 2,
              title: 'Giải pháp tự động',
              visual_description: 'Màn hình nhắc lịch tự động',
              narration: 'Quy trình 60 giây giúp khách xác nhận lịch ngay.',
              duration_estimate: 10,
            },
            {
              scene_number: 3,
              title: 'Kêu gọi hành động',
              visual_description: 'Nút ưu đãi nổi bật',
              narration: 'Nhấn vào đường dẫn ở mô tả để nhận bộ công cụ.',
              duration_estimate: 10,
            },
          ],
        }),
      };

      // 0. Reject commercial mutations with 403 PILOT_CONSENT_REQUIRED before terms are accepted
      const preConsentShortlink = await handleFirstValuePost(
        makeJsonPost({
          action: 'create_affiliate_shortlink',
          orgId: 'org_ceo_1',
          destinationUrl: 'https://shopee.vn/product/123456',
          ctaText: 'Nhận ưu đãi',
        }),
        deps,
      );
      expect(preConsentShortlink.status).toBe(403);

      // 1. Accept pilot consent
      const consentRes = await handleFirstValuePost(
        makeJsonPost({
          action: 'accept_pilot_terms',
          orgId: 'org_ceo_1',
          policyVersion: '2026-11-pilot-v2',
          accepted: true,
        }),
        deps,
      );
      expect(consentRes.status).toBe(200);

      // 2. Save OpenRouter BYOK key
      const byokRes = await handleFirstValuePost(
        makeJsonPost({
          action: 'save_byok_key',
          orgId: 'org_ceo_1',
          provider: 'openrouter',
          apiKey: 'sk-or-v1-validcustomerkey1234567890',
        }),
        deps,
      );
      expect(byokRes.status).toBe(200);

      // 3. Create live script review & accept it
      const createRes = await handleFirstValuePost(
        makeJsonPost(
          {
            action: 'create_review',
            orgId: 'org_ceo_1',
            missionId: 'mission_pilot_1',
            topic: 'Tự động nhắc lịch phòng khám',
            audience: 'Chủ phòng khám nha khoa',
            durationSec: 30,
            provenance: 'live_provider',
          },
          'idem-create-pilot-001',
        ),
        deps,
      );
      expect(createRes.status).toBe(201);
      const createdJson = (await createRes.json()) as { review: { artifactId: string; version: number } };
      const artifactId = createdJson.review.artifactId;

      const acceptRes = await handleFirstValuePost(
        makeJsonPost(
          {
            action: 'accept_review',
            orgId: 'org_ceo_1',
            artifactId,
            expectedVersion: createdJson.review.version,
            explicitUserAction: true,
          },
          'idem-accept-pilot-001',
        ),
        deps,
      );
      expect(acceptRes.status).toBe(200);

      // 4. Create Affiliate Shortlink (rejects http://, localhost, IPv6, self-redirect; accepts https://)
      for (const badDest of [
        'http://localhost:3000/steal',
        'https://[::1]/internal',
        'https://169.254.169.254/latest/meta-data',
        'https://sophia-ai-factory-pilot.agencyos-openclaw.workers.dev/api/r/abcdefghij',
      ]) {
        const badLinkRes = await handleFirstValuePost(
          makeJsonPost({
            action: 'create_affiliate_shortlink',
            orgId: 'org_ceo_1',
            artifactId,
            destinationUrl: badDest,
            ctaText: 'Nhận ưu đãi ngay',
          }),
          deps,
        );
        expect(badLinkRes.status).toBe(400);
      }

      // Rejects unowned shortCode on record_mp4_export before shortlink exists
      const unownedMp4Res = await handleFirstValuePost(
        makeJsonPost({
          action: 'record_mp4_export',
          orgId: 'org_ceo_1',
          artifactId,
          sha256Hex: 'a'.repeat(64),
          byteSize: 834_478,
          durationSec: 30,
          width: 320,
          height: 576,
          ctaText: 'Nhận ưu đãi',
          shortCode: 'zzzzzzzzzz',
          referralUrl: 'https://evil.example/phish',
        }),
        deps,
      );
      expect(unownedMp4Res.status).toBe(404);

      const linkRes = await handleFirstValuePost(
        makeJsonPost({
          action: 'create_affiliate_shortlink',
          orgId: 'org_ceo_1',
          artifactId,
          destinationUrl: 'https://shopee.vn/product/123456',
          ctaText: 'Nhấn link nhận ưu đãi 30% hôm nay',
          networkHint: 'shopee',
          disclosureTag: '#QuảngCáo',
        }),
        deps,
      );
      expect(linkRes.status).toBe(201);
      const linkJson = (await linkRes.json()) as {
        affiliateLink: { id: string; shortCode: string; shortUrl: string };
      };
      expect(linkJson.affiliateLink.shortUrl).toContain(
        `https://sophia-ai-factory-pilot.agencyos-openclaw.workers.dev/api/r/${linkJson.affiliateLink.shortCode}`,
      );

      // 5. Exercise real `GET /api/r/[code]` route handler in Pilot mode (valid mixed-case + unknown code without 500)
      const prevPilotMode = process.env.SOPHIA_PILOT_MODE;
      const prevGlobalEnv = (globalThis as unknown as { __env?: Record<string, unknown> }).__env;
      process.env.SOPHIA_PILOT_MODE = 'true';
      (globalThis as unknown as { __env?: Record<string, unknown> }).__env = { DB: d1 };
      try {
        const liveRouteRedirect = await handleShortlinkGet(
          new NextRequest(
            `https://sophia-ai-factory-pilot.agencyos-openclaw.workers.dev/api/r/${linkJson.affiliateLink.shortCode.toUpperCase()}`,
            {
              headers: {
                'cf-connecting-ip': '203.113.152.99',
                'cf-ipcountry': 'VN',
                referer: 'https://www.tiktok.com/@clinic/video/123',
              },
            },
          ),
          { params: Promise.resolve({ code: linkJson.affiliateLink.shortCode.toUpperCase() }) },
        );
        expect(liveRouteRedirect.status).toBe(302);
        expect(liveRouteRedirect.headers.get('location')).toContain('https://shopee.vn/product/123456');
        expect(liveRouteRedirect.headers.get('location')).toContain(
          `utm_content=sp_${linkJson.affiliateLink.shortCode}`,
        );

        // Unknown shortlink on pilot-only D1 returns clean 404 (never crashes querying legacy `affiliate_links`)
        const missingRouteRes = await handleShortlinkGet(
          new NextRequest(
            'https://sophia-ai-factory-pilot.agencyos-openclaw.workers.dev/api/r/abcdefghij',
          ),
          { params: Promise.resolve({ code: 'abcdefghij' }) },
        );
        expect(missingRouteRes.status).toBe(404);
      } finally {
        process.env.SOPHIA_PILOT_MODE = prevPilotMode;
        (globalThis as unknown as { __env?: Record<string, unknown> }).__env = prevGlobalEnv;
      }

      const rawClickRow = await sqlite
        .prepare('SELECT ip_hash, provenance FROM pilot_affiliate_clicks WHERE short_code = ?')
        .bind(linkJson.affiliateLink.shortCode)
        .first<{ ip_hash: string; provenance: string }>();
      expect(rawClickRow?.provenance).toBe('SERVER_VERIFIED_CLICK');
      expect(rawClickRow?.ip_hash).not.toContain('203.113');

      // 6. Record 1-Key Browser H.264 MP4 Export Receipt
      const mp4Res = await handleFirstValuePost(
        makeJsonPost({
          action: 'record_mp4_export',
          orgId: 'org_ceo_1',
          artifactId,
          sha256Hex: 'a'.repeat(64),
          byteSize: 834_478,
          durationSec: 30,
          width: 320,
          height: 576,
          codec: 'h264',
          containerBrand: 'isom',
          ctaText: 'Nhấn link nhận ưu đãi 30% hôm nay',
          shortCode: linkJson.affiliateLink.shortCode,
          referralUrl: linkJson.affiliateLink.shortUrl,
        }),
        deps,
      );
      expect(mp4Res.status).toBe(201);

      // 7. Optional HeyGen BYOK save -> submit -> poll completion
      const saveHgRes = await handleFirstValuePost(
        makeJsonPost({
          action: 'save_byok_key',
          orgId: 'org_ceo_1',
          provider: 'heygen',
          apiKey: 'heygen_live_key_abcdef1234567890',
        }),
        deps,
      );
      expect(saveHgRes.status).toBe(200);

      const submitHgRes = await handleFirstValuePost(
        makeJsonPost({
          action: 'submit_heygen_mp4',
          orgId: 'org_ceo_1',
          artifactId,
          ctaText: 'Nhấn link nhận ưu đãi 30% hôm nay',
          shortCode: linkJson.affiliateLink.shortCode,
          referralUrl: linkJson.affiliateLink.shortUrl,
        }),
        deps,
      );
      expect(submitHgRes.status).toBe(202);
      const submitHgJson = (await submitHgRes.json()) as { mp4Export: { id: string } };

      // Duplicate submit while still 'processing' returns existing job without burning extra credits
      const dupHgRes = await handleFirstValuePost(
        makeJsonPost({
          action: 'submit_heygen_mp4',
          orgId: 'org_ceo_1',
          artifactId,
          ctaText: 'Nhấn link nhận ưu đãi 30% hôm nay',
          shortCode: linkJson.affiliateLink.shortCode,
          referralUrl: linkJson.affiliateLink.shortUrl,
        }),
        deps,
      );
      expect(dupHgRes.status).toBe(200);
      const dupHgJson = (await dupHgRes.json()) as {
        inFlightDeduplicated?: boolean;
        paidInferenceExecuted: boolean;
      };
      expect(dupHgJson.inFlightDeduplicated).toBe(true);
      expect(dupHgJson.paidInferenceExecuted).toBe(false);

      const pollHgRes = await handleFirstValuePost(
        makeJsonPost({
          action: 'poll_heygen_mp4',
          orgId: 'org_ceo_1',
          exportId: submitHgJson.mp4Export.id,
        }),
        deps,
      );
      expect(pollHgRes.status).toBe(200);
      const pollHgJson = (await pollHgRes.json()) as {
        mp4Export: { status: string; providerVideoUrl: string };
      };
      expect(pollHgJson.mp4Export.status).toBe('completed');
      expect(pollHgJson.mp4Export.providerVideoUrl).toBe(
        'https://files2.heygen.ai/pilot/video-001.mp4',
      );

      // 8. Record Manual Publish + re-submit same post URL (verifies ON CONFLICT deduplication)
      const pubRes1 = await handleFirstValuePost(
        makeJsonPost({
          action: 'record_manual_publish',
          orgId: 'org_ceo_1',
          artifactId,
          linkId: linkJson.affiliateLink.id,
          platform: 'tiktok',
          publishedPostUrl: 'https://www.tiktok.com/@clinic_ceo/video/740000111222',
          reportedViews: 400,
          reportedConversions: null,
          reportedCommissionAmount: null,
          evidenceNote: 'Mới đăng 1 giờ trước',
        }),
        deps,
      );
      expect(pubRes1.status).toBe(201);

      const pubRes = await handleFirstValuePost(
        makeJsonPost({
          action: 'record_manual_publish',
          orgId: 'org_ceo_1',
          artifactId,
          linkId: linkJson.affiliateLink.id,
          platform: 'tiktok',
          publishedPostUrl: 'https://www.tiktok.com/@clinic_ceo/video/740000111222',
          reportedViews: 1250,
          reportedConversions: null,
          reportedCommissionAmount: null,
          evidenceNote: 'Mới đăng 2 giờ trước, đang theo dõi click thật',
        }),
        deps,
      );
      expect(pubRes.status).toBe(201);

      // Verify GET status snapshot exposes updated click count, MP4 exports, and manual publishes
      const statusGetRes = await handleFirstValueGet(
        new NextRequest(
          'https://sophia-ai-factory-pilot.agencyos-openclaw.workers.dev/api/first-value?orgId=org_ceo_1',
        ),
        deps,
      );
      expect(statusGetRes.status).toBe(200);
      const statusBody = (await statusGetRes.json()) as {
        pilot: {
          heygenByokConfigured: boolean;
          affiliateLinks: Array<{ verifiedClicks: number }>;
          mp4Exports: Array<{ status: string }>;
          manualPublishes: Array<{ provenance: string; reportedConversions: number | null }>;
        };
      };
      expect(statusBody.pilot.heygenByokConfigured).toBe(true);
      expect(statusBody.pilot.affiliateLinks[0]?.verifiedClicks).toBe(1);
      expect(statusBody.pilot.mp4Exports).toHaveLength(2);
      expect(statusBody.pilot.manualPublishes).toHaveLength(1);
      expect(statusBody.pilot.manualPublishes[0]?.provenance).toBe('CUSTOMER_SELF_REPORTED');
      expect(statusBody.pilot.manualPublishes[0]?.reportedConversions).toBeNull();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('calls HeyGen v1/video_status.get with 9:16 vertical dimensions and user-isolated breaker', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    try {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { video_id: 'hg_916_job' } }), { status: 200 }),
      );
      const sub = await submitPilotHeyGenByokVideo({
        userId: 'usr_a',
        apiKey: 'hg_key_valid_1234567890',
        script: 'Xin chào',
        title: '9:16 Test',
      });
      expect(sub.videoId).toBe('hg_916_job');
      const [, submitInit] = fetchSpy.mock.calls[0] ?? [];
      expect(String(submitInit?.body)).toContain('"width":720');
      expect(String(submitInit?.body)).toContain('"height":1280');

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              status: 'completed',
              video_url: 'https://resource2.heygen.ai/video/hg_916_job.mp4',
              duration: 14.2,
            },
          }),
          { status: 200 },
        ),
      );
      const polled = await fetchPilotHeyGenByokStatus({
        userId: 'usr_a',
        apiKey: 'hg_key_valid_1234567890',
        videoId: 'hg_916_job',
      });
      expect(fetchSpy.mock.calls[1]?.[0]).toBe(
        'https://api.heygen.com/v1/video_status.get?video_id=hg_916_job',
      );
      expect(polled).toEqual({
        status: 'completed',
        mediaUrl: 'https://resource2.heygen.ai/video/hg_916_job.mp4',
        durationSec: 14.2,
      });

      expect(() => assertSafeHeyGenMediaUrl('https://evil.example.com/v.mp4')).toThrow(
        /NOT_ALLOWLISTED/,
      );
      expect(() => assertSafeHeyGenMediaUrl('not-a-url')).toThrow(/INVALID/);
      expect(() => assertSafeHeyGenMediaUrl('http://files2.heygen.ai/v.mp4')).toThrow(/UNSAFE/);

      // HeyGen failed status & processing status & HTTP 402 error
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { status: 'failed', error: { message: 'Avatar invalid' } } }),
          { status: 200 },
        ),
      );
      const failedPoll = await fetchPilotHeyGenByokStatus({
        userId: 'usr_a',
        apiKey: 'hg_key_valid_1234567890',
        videoId: 'hg_fail',
      });
      expect(failedPoll.status).toBe('failed');

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { status: 'waiting' } }), { status: 200 }),
      );
      const procPoll = await fetchPilotHeyGenByokStatus({
        userId: 'usr_a',
        apiKey: 'hg_key_valid_1234567890',
        videoId: 'hg_wait',
      });
      expect(procPoll.status).toBe('processing');

      fetchSpy.mockResolvedValueOnce(new Response('Quota', { status: 402 }));
      await expect(
        submitPilotHeyGenByokVideo({
          userId: 'usr_a',
          apiKey: 'hg_key_valid_1234567890',
          script: 'Hi',
          title: 'T',
        }),
      ).rejects.toThrow(/402/);

      expect(resolveAffiliateSubIdParam('tiktok_shop')).toBe('aff_sub');
      expect(resolveAffiliateSubIdParam('clickbank')).toBe('tid');
      expect(resolveAffiliateSubIdParam('awin')).toBe('clickref');
      expect(resolveAffiliateSubIdParam('amazon')).toBe('tag');
      expect(resolveAffiliateSubIdParam('generic')).toBe('sub_id');
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('covers negative validation and error branches in HeyGen & manual publish handlers', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sophia-pilot-neg-'));
    try {
      const sqlite = new NodeSqliteD1Database(path.join(tmpDir, 'neg.sqlite'));
      for (const mig of [
        '0515_first_value_reviews.sql',
        '0517_customer_pilot_first_value.sql',
        '0519_pilot_support_requests.sql',
        '0520_pilot_commercial_validation.sql',
      ]) {
        await sqlite.exec(
          fs.readFileSync(path.resolve(__dirname, '../../../../migrations', mig), 'utf8'),
        );
      }
      const d1 = sqlite as unknown as D1Database;
      const baseDeps: FirstValueHttpDeps = {
        getD1: async () => d1,
        getCurrentUser: async () => ({ id: 'u1', email: 'ceo@customer.vn' }),
        verifyWorkspaceAccess: async () => true,
        verifyCsrf: () => true,
        listByokProviders: async () => [],
        signingSecret: 's'.repeat(32),
        pilotEnv: { PILOT_INVITE_ONLY: 'false' },
        probeHeyGenByokKey: async () => ({
          ok: false,
          valid: false,
          provider: 'heygen',
          status: 'INVALID',
          httpStatus: 401,
          latencyMs: 10,
          message: 'Bad key',
          message_vi: 'Khóa sai',
          maskedKey: '****',
        }),
        saveHeyGenByokKey: async () => {},
      };

      // Invalid format HeyGen key (contains spaces)
      const fmtRes = await handleFirstValuePost(
        makeJsonPost({
          action: 'save_byok_key',
          orgId: 'o1',
          provider: 'heygen',
          apiKey: 'bad key with spaces 12345',
        }),
        baseDeps,
      );
      expect(fmtRes.status).toBe(400);

      // Rejected 401 HeyGen probe
      const rejRes = await handleFirstValuePost(
        makeJsonPost({
          action: 'save_byok_key',
          orgId: 'o1',
          provider: 'heygen',
          apiKey: 'heygen_rejected_key_123456',
        }),
        baseDeps,
      );
      expect(rejRes.status).toBe(422);

      // Missing clearHeyGenByokKey dep -> 503
      const noClearRes = await handleFirstValuePost(
        makeJsonPost({ action: 'clear_byok_key', orgId: 'o1', provider: 'heygen' }),
        baseDeps,
      );
      expect(noClearRes.status).toBe(503);

      // Invalid post URL & missing foreign IDs on record_manual_publish
      const badPostUrl = await handleFirstValuePost(
        makeJsonPost({
          action: 'record_manual_publish',
          orgId: 'o1',
          platform: 'tiktok',
          publishedPostUrl: 'http://localhost/post',
        }),
        baseDeps,
      );
      expect(badPostUrl.status).toBe(400);

      const missingArt = await handleFirstValuePost(
        makeJsonPost({
          action: 'record_manual_publish',
          orgId: 'o1',
          artifactId: 'missing_art',
          platform: 'tiktok',
          publishedPostUrl: 'https://www.tiktok.com/@u/video/1',
        }),
        baseDeps,
      );
      expect(missingArt.status).toBe(404);

      const missingExp = await handleFirstValuePost(
        makeJsonPost({
          action: 'record_manual_publish',
          orgId: 'o1',
          mp4ExportId: 'missing_exp',
          platform: 'tiktok',
          publishedPostUrl: 'https://www.tiktok.com/@u/video/1',
        }),
        baseDeps,
      );
      expect(missingExp.status).toBe(404);

      const missingLnk = await handleFirstValuePost(
        makeJsonPost({
          action: 'record_manual_publish',
          orgId: 'o1',
          linkId: 'missing_lnk',
          platform: 'tiktok',
          publishedPostUrl: 'https://www.tiktok.com/@u/video/1',
        }),
        baseDeps,
      );
      expect(missingLnk.status).toBe(404);

      // Missing export on poll_heygen_mp4
      const missingPoll = await handleFirstValuePost(
        makeJsonPost({ action: 'poll_heygen_mp4', orgId: 'o1', exportId: 'pme_none' }),
        baseDeps,
      );
      expect(missingPoll.status).toBe(404);

      // Invalid shortlink code in Pilot mode -> 404
      const prevPilot = process.env.SOPHIA_PILOT_MODE;
      process.env.SOPHIA_PILOT_MODE = 'true';
      try {
        const invalidCodeRes = await handleShortlinkGet(
          new NextRequest('https://sophia-ai-factory-pilot.agencyos-openclaw.workers.dev/api/r/BAD!'),
          { params: { code: 'BAD!' } },
        );
        expect(invalidCodeRes.status).toBe(404);
      } finally {
        process.env.SOPHIA_PILOT_MODE = prevPilot;
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('redacts secrets in ops triage, keys IP hashes with HMAC, reports ON_DEMAND_CLI honestly, and maps REPORT 10/12 verdicts accurately', async () => {
    const h1 = await hashPilotVisitorIp('203.113.152.99, 10.0.0.1', 'secret-key-alpha');
    const h2 = await hashPilotVisitorIp('203.113.152.99', 'secret-key-alpha');
    const h3 = await hashPilotVisitorIp('203.113.152.99', 'secret-key-beta');
    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);

    const scrubbed = redactSensitiveText(
      'Keys sk-or-v1-secret123456789 YzI5d2FHaGhMVzRsZV== aB1cD2eF3gH4iJ5kL6 AbCdEfGhIjKlMnOpQrStUvWxYz+/== failed for ceo@company.vn with Bearer eyJhbGciOiJIUzI1NiJ9',
    );
    expect(scrubbed).not.toContain('sk-or-v1-secret');
    expect(scrubbed).not.toContain('YzI5d2FHaGhMVzRsZV==');
    expect(scrubbed).not.toContain('aB1cD2eF3gH4iJ5kL6');
    expect(scrubbed).not.toContain('AbCdEfGhIjKlMnOpQrStUvWxYz+/==');
    expect(scrubbed).not.toContain('ceo@company.vn');
    expect(scrubbed).not.toContain('eyJhbGci');
    expect(scrubbed).toContain('[REDACTED_API_KEY]');
    expect(scrubbed).toContain('[REDACTED_EMAIL]');

    const emptyOps = collectLivePilotOpsSnapshot((sql: string) => {
      if (sql.includes('sqlite_master')) {
        return [
          'user',
          'session',
          'user_api_keys',
          'first_value_reviews',
          'pilot_consents',
          'pilot_usage_quotas',
          'pilot_events',
          'pilot_feedback',
          'pilot_support_requests',
          'pilot_affiliate_links',
          'pilot_affiliate_clicks',
          'pilot_mp4_exports',
          'pilot_manual_publishes',
        ].map((name) => ({ name }));
      }
      return [];
    });
    expect(emptyOps.monitoringMode).toBe('ON_DEMAND_CLI');
    expect(emptyOps.backgroundMonitoringConfigured).toBe(false);
    expect(emptyOps.p0p1Findings).toEqual([]);

    const holdDecision = evaluatePilotDecisionAgainstResearch(emptyOps);
    expect(holdDecision.verdict).toBe('HOLD');
    expect(formatDecisionMarkdown(holdDecision)).toContain('REPORT 10');
    expect(formatDecisionMarkdown(holdDecision)).toContain('REPORT 12');

    // P0 triggers FIX
    const brokenOps = {
      ...emptyOps,
      p0p1Findings: classifyPilotP0P1Findings({
        ...emptyOps,
        missingTables: ['pilot_mp4_exports'],
      }),
    };
    expect(evaluatePilotDecisionAgainstResearch(brokenOps).verdict).toBe('FIX');

    // Early verified activation triggers BUILD
    const buildOps = {
      ...emptyOps,
      eventCounts: { INVITE_ACCEPTED: 1, BYOK_KEY_SAVED: 1, GENERATION_SUCCEEDED: 1 },
      commercialEvidence: {
        ...emptyOps.commercialEvidence,
        mp4CompletedWithCtaAndLink: 1,
        affiliateShortlinksCreated: 1,
        serverVerifiedClicks: 2,
      },
    };
    expect(evaluatePilotDecisionAgainstResearch(buildOps).verdict).toBe('BUILD');

    // Strong multi-video + verified clicks + real conversion triggers SCALE
    const scaleOps = {
      ...emptyOps,
      eventCounts: { INVITE_ACCEPTED: 1, BYOK_KEY_SAVED: 1, GENERATION_SUCCEEDED: 4 },
      commercialEvidence: {
        mp4CompletedWithCtaAndLink: 3,
        mp4FailedCount: 0,
        affiliateShortlinksCreated: 2,
        serverVerifiedClicks: 12,
        manualPublishesByPlatform: [
          {
            platform: 'tiktok',
            posts: 2,
            selfReportedViews: 4200,
            selfReportedConversions: 2,
            provenance: 'CUSTOMER_SELF_REPORTED',
          },
        ],
      },
    };
    expect(evaluatePilotDecisionAgainstResearch(scaleOps).verdict).toBe('SCALE');
  });
});
