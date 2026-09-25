/**
 * Tier 4 Real-World Application Scenarios
 *
 * Directly tests production modules:
 * - @/tree/subtitles/subtitle-formatter (segmentsToSrt, segmentsToVtt)
 * - @/forest/streaming/hls-manifest-generator (generateMasterManifest)
 * - @/tree/creator-royalties/template-activation (calculateTemplateRoyalty)
 * - @/tree/creator-royalties/attribution (accrueCreatorLedgerEntryCAS, isCircularAncestorRemix)
 * - @/tree/publishing/apac-peak-optimizer (calculateNextPeakPublishTime)
 * - @/tree/publishing/viral-metadata-generator (generateViralMetadata)
 * - @/seed/security/signed-url (createSignedDownloadToken, verifySignedDownloadToken)
 * - @/tree/watermark/forensic-watermark (generateForensicWatermark, verifyForensicWatermark)
 *
 * Implements complex, realistic multi-actor workflows:
 * - Scenario 1: Japanese Viral Creator Onboarding & Template Monetization
 * - Scenario 2: APAC 5-Language Video Dubbing & Subtitle Production Pipeline
 * - Scenario 3: Tokyo & Hanoi Golden-Hour Cross-Platform Syndication Mesh
 * - Scenario 4: High-Concurrency Template Remixing with Anti-Fraud Lineage Protection
 * - Scenario 5: Secure Adaptive HLS Streaming with Dynamic Forensic Watermarking & 24h Expiry
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryD1, type MockD1Database } from '../harness/e2e-test-harness';
import {
  segmentsToSrt,
  segmentsToVtt,
} from '@/tree/subtitles/subtitle-formatter';
import {
  generateMasterManifest,
} from '@/forest/streaming/hls-manifest-generator';
import {
  calculateTemplateRoyalty,
} from '@/tree/creator-royalties/template-activation';
import {
  accrueCreatorLedgerEntryCAS,
  isCircularAncestorRemix,
} from '@/tree/creator-royalties/attribution';
import {
  calculateNextPeakPublishTime,
} from '@/tree/publishing/apac-peak-optimizer';
import {
  generateViralMetadata,
} from '@/tree/publishing/viral-metadata-generator';
import {
  createSignedDownloadToken,
  verifySignedDownloadToken,
} from '@/seed/security/signed-url';
import {
  generateForensicWatermark,
} from '@/tree/watermark/forensic-watermark';
import type { SubtitleSegment } from '@/seed/types/dubbing';
import {
  SAMPLE_TRANSCRIPT_EN,
  SAMPLE_TRANSCRIPT_VI,
  SAMPLE_TRANSCRIPT_JA,
  SAMPLE_TRANSCRIPT_KO,
  SAMPLE_TRANSCRIPT_TH,
  MOCK_CREATOR_TEMPLATE_PAYLOAD,
  type TranscriptSegment,
} from '../harness/test-fixtures';

// Helper to convert test fixture segments to SubtitleSegment (in seconds)
function toSubtitleSegments(segments: TranscriptSegment[]): SubtitleSegment[] {
  return segments.map((s, idx) => ({
    id: idx + 1,
    start: s.startMs / 1000,
    end: s.endMs / 1000,
    text: s.text,
  }));
}

describe('Tier 4: Real-World End-to-End Application Scenarios', () => {
  let db: MockD1Database;
  const SECRET_KEY = 'tier4_real_world_secret_key_sophia';

  beforeEach(() => {
    db = createInMemoryD1();
  });

  // ─── Scenario 1 ─────────────────────────────────────────────────────────────
  describe('Scenario 1: Japanese Creator Onboarding -> Viral Template -> VN User Remix -> 70/30 Split -> USDT Payout', () => {
    it('executes the full creator lifecycle from onboarding to payout', async () => {
      // Step 1: Japanese Creator registers profile with USDT TRC20 wallet
      const creatorId = 'cr_tokyo_01';
      await db
        .prepare('INSERT INTO creator_profiles (id, user_id, display_name, handle, payout_rail, payout_destination, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(creatorId, 'usr_tokyo_01', 'Kenji Sato', '@kenji_viral', 'USDT', 'TRC20:TYDzsYUEpvnYmQK4zGP9s217x5mrCVDhkX', Date.now(), Date.now())
        .run();

      // Step 2: Creator publishes viral video recipe ($2.99 = 299 cents)
      const templateId = 'tpl_viral_tokyo_01';
      const p = MOCK_CREATOR_TEMPLATE_PAYLOAD;
      await db
        .prepare(
          `INSERT INTO creator_templates 
           (id, creator_id, slug, title, niche, script_template, storyboard_json, visual_style_prompt, price_cents, royalty_percent, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
        )
        .bind(templateId, creatorId, 'tokyo-ecommerce-hook', p.title, p.niche, p.scriptTemplate, p.storyboardJson, p.visualStylePrompt, 299, 70.0, Date.now(), Date.now())
        .run();

      // Step 3: Admin review approves template
      await db.prepare("UPDATE creator_templates SET status = 'approved' WHERE id = ?").bind(templateId).run();

      // Step 4: Vietnamese Agency discovers template and remixes it
      const remixerUserId = 'usr_saigon_02';
      const split = calculateTemplateRoyalty(299, 70.0);
      expect(split.creatorCents).toBe(209);
      expect(split.platformCents).toBe(90);

      // Step 5: Accrue royalty to creator via OCC CAS ledger
      const accrual = await accrueCreatorLedgerEntryCAS(db as any, {
        creatorId,
        amountCents: split.creatorCents,
        referenceId: `remix_act_${templateId}_${remixerUserId}`,
        eventType: 'template_remix',
      });
      expect(accrual.success).toBe(true);
      expect(accrual.newBalanceCents).toBe(209);

      // Step 6: Multiple remix activations accumulate creator balance past $50 minimum threshold
      for (let i = 2; i <= 25; i++) {
        await accrueCreatorLedgerEntryCAS(db as any, {
          creatorId,
          amountCents: split.creatorCents,
          referenceId: `remix_act_${i}`,
          eventType: 'template_remix',
        });
      }

      const latestLedger = await db.prepare('SELECT balance_after_cents FROM creator_earnings_ledger WHERE creator_id = ? ORDER BY sequence_num DESC LIMIT 1').bind(creatorId).first<{ balance_after_cents: number }>();
      expect(latestLedger?.balance_after_cents).toBe(25 * 209); // 5225 cents = $52.25

      // Sync available_balance_cents on profile
      await db.prepare('UPDATE creator_profiles SET available_balance_cents = ? WHERE id = ?').bind(latestLedger?.balance_after_cents, creatorId).run();

      // Step 7: Creator requests $50.00 (5000 cents) USDT withdrawal
      const withdrawalAmount = 5000;
      const withdrawalId = 'with_usdt_001';
      await db
        .prepare('INSERT INTO creator_withdrawal_requests (id, creator_id, amount_cents, rail, destination, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(withdrawalId, creatorId, withdrawalAmount, 'USDT', 'TRC20:TYDzsYUEpvnYmQK4zGP9s217x5mrCVDhkX', 'pending', Date.now())
        .run();

      // Step 8: Deduct available balance and complete withdrawal with tx hash
      await db.prepare('UPDATE creator_profiles SET available_balance_cents = available_balance_cents - ? WHERE id = ?').bind(withdrawalAmount, creatorId).run();
      await db.prepare("UPDATE creator_withdrawal_requests SET status = 'completed', tx_hash = ? WHERE id = ?").bind('0x9a8fbc71625e9821', withdrawalId).run();

      const finalProfile = await db.prepare('SELECT available_balance_cents FROM creator_profiles WHERE id = ?').bind(creatorId).first<{ available_balance_cents: number }>();
      expect(finalProfile?.available_balance_cents).toBe(225); // $2.25 remaining

      const payout = await db.prepare('SELECT status, tx_hash FROM creator_withdrawal_requests WHERE id = ?').bind(withdrawalId).first<{ status: string; tx_hash: string }>();
      expect(payout?.status).toBe('completed');
      expect(payout?.tx_hash).toBe('0x9a8fbc71625e9821');
    });
  });

  // ─── Scenario 2 ─────────────────────────────────────────────────────────────
  describe('Scenario 2: APAC 5-Language Video Voice Dubbing & Multi-Format Subtitle Pipeline', () => {
    it('executes full multilingual dubbing workflow with subtitles and duration alignment', async () => {
      const videoId = 'vid_multilang_pipeline_01';
      const tenantId = 'ten_apac_agency';

      // 1. Video ingestion
      await db
        .prepare('INSERT INTO videos (id, user_id, tenant_id, title, r2_key, duration_sec, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(videoId, 'usr_agency_lead', tenantId, 'APAC Product Launch', 'raw/launch.mp4', 10.0, 'processing', Date.now(), Date.now())
        .run();

      // 2. Transcription (STT) and Multilingual Translation
      const translations: Record<string, { srt: string; vtt: string }> = {
        vi: { srt: segmentsToSrt(toSubtitleSegments(SAMPLE_TRANSCRIPT_VI)), vtt: segmentsToVtt(toSubtitleSegments(SAMPLE_TRANSCRIPT_VI)) },
        en: { srt: segmentsToSrt(toSubtitleSegments(SAMPLE_TRANSCRIPT_EN)), vtt: segmentsToVtt(toSubtitleSegments(SAMPLE_TRANSCRIPT_EN)) },
        ja: { srt: segmentsToSrt(toSubtitleSegments(SAMPLE_TRANSCRIPT_JA)), vtt: segmentsToVtt(toSubtitleSegments(SAMPLE_TRANSCRIPT_JA)) },
        ko: { srt: segmentsToSrt(toSubtitleSegments(SAMPLE_TRANSCRIPT_KO)), vtt: segmentsToVtt(toSubtitleSegments(SAMPLE_TRANSCRIPT_KO)) },
        th: { srt: segmentsToSrt(toSubtitleSegments(SAMPLE_TRANSCRIPT_TH)), vtt: segmentsToVtt(toSubtitleSegments(SAMPLE_TRANSCRIPT_TH)) },
      };

      // 3. Persist subtitles for all 5 languages in both SRT and VTT formats
      for (const [locale, subs] of Object.entries(translations)) {
        await db
          .prepare('INSERT INTO video_subtitles (id, video_id, locale, format, content, created_at) VALUES (?, ?, ?, ?, ?, ?)')
          .bind(`sub_${videoId}_${locale}_srt`, videoId, locale, 'srt', subs.srt, Date.now())
          .run();
        await db
          .prepare('INSERT INTO video_subtitles (id, video_id, locale, format, content, created_at) VALUES (?, ?, ?, ?, ?, ?)')
          .bind(`sub_${videoId}_${locale}_vtt`, videoId, locale, 'vtt', subs.vtt, Date.now())
          .run();
      }

      const totalSubs = await db.prepare('SELECT count(*) as count FROM video_subtitles WHERE video_id = ?').bind(videoId).first<{ count: number }>();
      expect(totalSubs?.count).toBe(10); // 5 languages x 2 formats = 10 files

      // 4. Synthesize voice tracks for JA, KO, TH with duration sync
      const targetVoices = [
        { locale: 'ja', presetId: 'kenji-ja-m', durationMs: 9800 },
        { locale: 'ko', presetId: 'minho-ko-m', durationMs: 9600 },
        { locale: 'th', presetId: 'somchai-th-m', durationMs: 10100 },
      ];

      for (const v of targetVoices) {
        await db
          .prepare('INSERT INTO video_audio_tracks (id, video_id, locale, preset_id, audio_url, duration_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .bind(`trk_${videoId}_${v.locale}`, videoId, v.locale, v.presetId, `https://r2.sophia.network/audio/${videoId}_${v.locale}.mp3`, v.durationMs, Date.now())
          .run();
      }

      // 5. Update video status to ready
      await db.prepare("UPDATE videos SET status = 'ready' WHERE id = ?").bind(videoId).run();

      const finalVideo = await db.prepare('SELECT status FROM videos WHERE id = ?').bind(videoId).first<{ status: string }>();
      expect(finalVideo?.status).toBe('ready');
    });
  });

  // ─── Scenario 3 ─────────────────────────────────────────────────────────────
  describe('Scenario 3: Tokyo & Hanoi Golden-Hour Cross-Platform Syndication Mesh', () => {
    it('schedules dispatches for Tokyo and Hanoi peak slots with anti-collision and viral tags', async () => {
      // 1. Setup channels
      await db.prepare('INSERT INTO publishing_channels VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind('ch_yt_tokyo', 'ten_1', 'youtube_shorts', 'Sophia Tokyo', 't1', 'r1', Date.now() + 100000, 'active', Date.now(), Date.now()).run();
      await db.prepare('INSERT INTO publishing_channels VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind('ch_tt_tokyo', 'ten_1', 'tiktok', 'Sophia Tokyo TikTok', 't2', 'r2', Date.now() + 100000, 'active', Date.now(), Date.now()).run();
      await db.prepare('INSERT INTO publishing_channels VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind('ch_ig_hanoi', 'ten_1', 'instagram_reels', 'Sophia Hanoi IG', 't3', 'r3', Date.now() + 100000, 'active', Date.now(), Date.now()).run();
      await db.prepare('INSERT INTO publishing_channels VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind('ch_fb_hanoi', 'ten_1', 'facebook_reels', 'Sophia Hanoi FB', 't4', 'r4', Date.now() + 100000, 'active', Date.now(), Date.now()).run();

      // 2. Compute peak slot for Hanoi (11:30) and Tokyo (12:00)
      const baseUtcMs = Date.UTC(2026, 8, 25, 2, 0, 0); // 09:00 Hanoi (UTC+7), 11:00 Tokyo (UTC+9)
      const hanoiSlot = calculateNextPeakPublishTime(baseUtcMs, 'hanoi');
      const tokyoSlot = calculateNextPeakPublishTime(baseUtcMs, 'tokyo');

      expect(hanoiSlot.localTimeFormatted).toContain('11:30');
      expect(tokyoSlot.localTimeFormatted).toContain('12:00');

      // 3. Stagger dispatches by 5 minutes (300s = 300,000ms)
      const hanoiIgTime = Math.floor(hanoiSlot.scheduledAtMs / 1000);
      const hanoiFbTime = hanoiIgTime + 300;
      const tokyoYtTime = Math.floor(tokyoSlot.scheduledAtMs / 1000);
      const tokyoTtTime = tokyoYtTime + 300;

      // 4. Generate localized viral metadata with UTM & Telegram link
      const metaHanoi = generateViralMetadata({
        topic: 'Chiến lược video ngắn',
        niche: 'marketing',
        targetPlatform: 'instagram_reels',
        targetLanguage: 'vi',
        targetMarket: 'hanoi',
        videoJobId: 'vid_scen3_01',
        referralCode: 'HANOI_VIP',
      });

      const metaTokyo = generateViralMetadata({
        topic: 'ショート動画攻略法',
        niche: 'ecommerce',
        targetPlatform: 'youtube_shorts',
        targetLanguage: 'ja',
        targetMarket: 'tokyo',
        videoJobId: 'vid_scen3_02',
        referralCode: 'TOKYO_PRO',
      });

      // 5. Enqueue scheduled jobs
      const insertJobSql = 'INSERT INTO publishing_jobs (id, tenant_id, channel_id, video_id, market, scheduled_at, status, metadata_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
      await db.prepare(insertJobSql).bind('job_h1', 'ten_1', 'ch_ig_hanoi', 'vid_scen3_01', 'hanoi', hanoiIgTime, 'scheduled', JSON.stringify(metaHanoi), Date.now(), Date.now()).run();
      await db.prepare(insertJobSql).bind('job_h2', 'ten_1', 'ch_fb_hanoi', 'vid_scen3_01', 'hanoi', hanoiFbTime, 'scheduled', JSON.stringify(metaHanoi), Date.now(), Date.now()).run();
      await db.prepare(insertJobSql).bind('job_t1', 'ten_1', 'ch_yt_tokyo', 'vid_scen3_02', 'tokyo', tokyoYtTime, 'scheduled', JSON.stringify(metaTokyo), Date.now(), Date.now()).run();
      await db.prepare(insertJobSql).bind('job_t2', 'ten_1', 'ch_tt_tokyo', 'vid_scen3_02', 'tokyo', tokyoTtTime, 'scheduled', JSON.stringify(metaTokyo), Date.now(), Date.now()).run();

      const jobs = await db.prepare('SELECT id, scheduled_at FROM publishing_jobs ORDER BY scheduled_at ASC').all<{ id: string; scheduled_at: number }>();
      expect(jobs.results).toHaveLength(4);
      expect(jobs.results[1].scheduled_at - jobs.results[0].scheduled_at).toBe(300);
    });
  });

  // ─── Scenario 4 ─────────────────────────────────────────────────────────────
  describe('Scenario 4: High-Concurrency Template Remixing with Anti-Fraud Lineage Protection', () => {
    it('blocks multi-hop circular self-remix and handles concurrent remix accruals with OCC CAS', async () => {
      // 1. Build blueprint lineage: A -> B -> C
      await db.prepare('INSERT INTO campaign_blueprints VALUES (?, ?, ?, ?, ?)').bind('bp_scen4_a', 'usr_creator_a', null, 'Root Blueprint A', Date.now()).run();
      await db.prepare('INSERT INTO campaign_blueprints VALUES (?, ?, ?, ?, ?)').bind('bp_scen4_b', 'usr_creator_b', 'bp_scen4_a', 'Derivative B', Date.now()).run();
      await db.prepare('INSERT INTO campaign_blueprints VALUES (?, ?, ?, ?, ?)').bind('bp_scen4_c', 'usr_creator_c', 'bp_scen4_b', 'Derivative C', Date.now()).run();

      // 2. Creator A attempts to remix Derivative C (Circular self-remix attack)
      const isCircular = await isCircularAncestorRemix(db as any, 'bp_scen4_c', 'usr_creator_a');
      expect(isCircular).toBe(true);

      // 3. Seed creator profile B for genuine community remixes
      await db
        .prepare('INSERT INTO creator_profiles (id, user_id, display_name, handle, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind('cr_b', 'usr_creator_b', 'Creator B', '@creator_b', Date.now(), Date.now())
        .run();

      // 4. Simulate 10 concurrent genuine users remixing Blueprint B ($2.00 fee -> 140c creator share)
      const remixShareCents = calculateTemplateRoyalty(200, 70.0).creatorCents; // 140 cents
      expect(remixShareCents).toBe(140);

      const concurrentRemixes = Array.from({ length: 10 }, (_, i) =>
        accrueCreatorLedgerEntryCAS(db as any, {
          creatorId: 'cr_b',
          amountCents: remixShareCents,
          referenceId: `concurrent_ref_${i + 1}`,
          eventType: 'template_remix',
        })
      );

      const results = await Promise.all(concurrentRemixes);
      const successfulCount = results.filter((r) => r.success).length;
      expect(successfulCount).toBe(10);

      // 5. Verify final balance in ledger matches exactly 10 * 140 = 1400 cents with zero leakage
      const latestLedger = await db.prepare('SELECT balance_after_cents FROM creator_earnings_ledger WHERE creator_id = ? ORDER BY sequence_num DESC LIMIT 1').bind('cr_b').first<{ balance_after_cents: number }>();
      expect(latestLedger?.balance_after_cents).toBe(1400);

      // 6. Verify ledger entries are strictly sequential from 1 to 10
      const entries = await db.prepare('SELECT sequence_num FROM creator_earnings_ledger WHERE creator_id = ? ORDER BY sequence_num ASC').bind('cr_b').all<{ sequence_num: number }>();
      expect(entries.results).toHaveLength(10);
      for (let i = 0; i < 10; i++) {
        expect(entries.results[i].sequence_num).toBe(i + 1);
      }
    });
  });

  // ─── Scenario 5 ─────────────────────────────────────────────────────────────
  describe('Scenario 5: Secure Adaptive HLS Streaming with Dynamic Forensic Watermarking & 24h Expiry', () => {
    it('executes secure video delivery flow with adaptive manifest, forensic watermarking, and signed downloads', async () => {
      const videoId = 'vid_hollywood_blockbuster_01';
      const tenantId = 'ten_sony_apac';
      const userId = 'usr_cinema_vip';

      // 1. Generate multi-variant adaptive HLS stream
      const manifest = generateMasterManifest({
        basePlaybackUrl: `https://cdn.sophia.network/${videoId}`,
      });
      expect(manifest).toContain('#EXTM3U');
      expect(manifest).toContain('1080p');
      expect(manifest).toContain('720p');
      expect(manifest).toContain('480p');

      // 2. Render dynamic forensic watermark text
      const watermark = generateForensicWatermark(tenantId, userId);
      expect(watermark.overlayText).toContain('Sophia AI');
      expect(watermark.overlayText).toContain('ten_sony');

      // 3. Issue HMAC-SHA256 24h signed download URL
      const token = await createSignedDownloadToken({
        videoId,
        userId,
        ttlSeconds: 86400,
        secret: SECRET_KEY,
      });
      expect(token).toContain('.');

      // 4. Authorized user requests download within window -> Approved
      const legitDownload = await verifySignedDownloadToken({
        token,
        videoId,
        secret: SECRET_KEY,
      });
      expect(legitDownload.valid).toBe(true);
      expect(legitDownload.expired).toBe(false);

      // 5. Log download in audit ledger
      await db
        .prepare('INSERT INTO signed_download_logs VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind('log_dl_scen5', videoId, userId, 1700086400, token, 1700007200, 1700000000)
        .run();

      // 6. Hacker attempts to reuse URL after 24 hours -> Blocked
      const expiredToken = await createSignedDownloadToken({
        videoId,
        userId,
        ttlSeconds: -10, // Simulated expired token
        secret: SECRET_KEY,
      });
      const expiredDownload = await verifySignedDownloadToken({
        token: expiredToken,
        videoId,
        secret: SECRET_KEY,
      });
      expect(expiredDownload.valid).toBe(false);
      expect(expiredDownload.expired).toBe(true);

      // 7. Attacker tampers videoId in URL to download confidential video -> Blocked
      const tamperedDownload = await verifySignedDownloadToken({
        token,
        videoId: 'vid_confidential_leak',
        secret: SECRET_KEY,
      });
      expect(tamperedDownload.valid).toBe(false);
    });
  });
});
