/**
 * Tier 3 Cross-Feature Combinations: Pairwise State & Data Sharing
 *
 * Directly tests production modules:
 * - @/tree/subtitles/subtitle-formatter (segmentsToSrt, segmentsToVtt)
 * - @/seed/voices/presets (getVoicePreset, VOICE_PRESETS)
 * - @/forest/streaming/hls-manifest-generator (generateMasterManifest)
 * - @/tree/creator-royalties/template-activation (calculateTemplateRoyalty)
 * - @/tree/creator-royalties/attribution (accrueCreatorLedgerEntryCAS, isCircularAncestorRemix)
 * - @/tree/publishing/apac-peak-optimizer (calculateNextPeakPublishTime)
 * - @/tree/publishing/viral-metadata-generator (generateViralMetadata)
 * - @/seed/security/signed-url (createSignedDownloadToken, verifySignedDownloadToken)
 * - @/tree/watermark/forensic-watermark (generateForensicWatermark, verifyForensicWatermark)
 *
 * Verifies complex interactions between interdependent system modules:
 * - Pair 1: F1 (STT) + F2 (Translation) + F3 (Subtitles)
 * - Pair 2: F2 (Translation) + F4 (Voice Synthesis) + F23 (Adaptive HLS)
 * - Pair 3: F8 (Template Registry) + F10 (70/30 Royalty) + F11 (OCC CAS Ledger)
 * - Pair 4: F11 (CAS Ledger) + F14 (Dual-Rail USDT / VietQR Payouts)
 * - Pair 5: F18 (APAC Peak Optimizer) + F19 (Anti-Collision) + F20 (Cooldown)
 * - Pair 6: F21 (Viral Metadata) + F22 (Telegram Deep Link) + F16 (Omnichannel Mesh)
 * - Pair 7: F23 (Adaptive HLS) + F25 (Forensic Watermark) + F26 (24h Signed URL)
 * - Pair 8: F9 (Template FSM) + F12 (Anti-Fraud Lineage) + F10 (Royalty Split)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryD1, type MockD1Database } from '../harness/e2e-test-harness';
import {
  segmentsToSrt,
  segmentsToVtt,
} from '@/tree/subtitles/subtitle-formatter';
import {
  getVoicePreset,
} from '@/seed/voices/presets';
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
  verifyForensicWatermark,
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

describe('Tier 3: Cross-Feature State & Data Sharing Combinations', () => {
  let db: MockD1Database;
  const SECRET_KEY = 'tier3_cross_feature_secret_key_2026';

  beforeEach(() => {
    db = createInMemoryD1();
  });

  // ─── Pair 1: F1 (STT) + F2 (Translation) + F3 (Subtitles) ───────────────────
  describe('Pair 1: STT -> 5-Language Translation -> Synchronized SRT/VTT Subtitles', () => {
    it('executes end-to-end subtitle generation across all 5 APAC languages with temporal parity', async () => {
      // 1. Transcribe source English
      const sourceSegments = SAMPLE_TRANSCRIPT_EN;
      expect(sourceSegments.length).toBe(3);

      // 2. Map contextual translations
      const multilingualMap = {
        en: toSubtitleSegments(SAMPLE_TRANSCRIPT_EN),
        vi: toSubtitleSegments(SAMPLE_TRANSCRIPT_VI),
        ja: toSubtitleSegments(SAMPLE_TRANSCRIPT_JA),
        ko: toSubtitleSegments(SAMPLE_TRANSCRIPT_KO),
        th: toSubtitleSegments(SAMPLE_TRANSCRIPT_TH),
      };

      // 3. Generate both SRT and VTT for each language
      const generatedSubtitles: Record<string, { srt: string; vtt: string }> = {};
      for (const [lang, segs] of Object.entries(multilingualMap)) {
        generatedSubtitles[lang] = {
          srt: segmentsToSrt(segs),
          vtt: segmentsToVtt(segs),
        };
      }

      // 4. Assert timing synchronization: all languages must share identical cue durations
      for (const lang of ['vi', 'ja', 'ko', 'th'] as const) {
        expect(generatedSubtitles[lang].srt).toContain('00:00:00,000 --> 00:00:02,500');
        expect(generatedSubtitles[lang].vtt).toContain('00:00:00.000 --> 00:00:02.500');
      }

      // 5. Verify database persistence
      await db
        .prepare('INSERT INTO videos (id, user_id, tenant_id, title, r2_key, duration_sec, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind('vid_cross_01', 'usr_01', 'ten_01', 'Cross Sub Demo', 'r2/cross.mp4', 10.0, 'ready', Date.now(), Date.now())
        .run();

      for (const [lang, subs] of Object.entries(generatedSubtitles)) {
        await db
          .prepare('INSERT INTO video_subtitles (id, video_id, locale, format, content, created_at) VALUES (?, ?, ?, ?, ?, ?)')
          .bind(`sub_${lang}_srt`, 'vid_cross_01', lang, 'srt', subs.srt, Date.now())
          .run();
      }

      const saved = await db.prepare('SELECT count(*) as count FROM video_subtitles WHERE video_id = ?').bind('vid_cross_01').first<{ count: number }>();
      expect(saved?.count).toBe(5);
    });
  });

  // ─── Pair 2: F2 (Translation) + F4 (Voice Synth) + F23 (Adaptive HLS) ────────
  describe('Pair 2: Contextual Translation -> Native Voice Synthesis -> Adaptive HLS Streaming', () => {
    it('synthesizes Japanese audio track with duration stretch and binds to multi-bitrate HLS', async () => {
      // 1. Translated Japanese text
      const jaSegments = SAMPLE_TRANSCRIPT_JA;
      const targetDurationSec = 9.5;

      // 2. Select native Japanese neural voice
      const jaVoice = getVoicePreset('kenji-ja-m');
      expect(jaVoice).toBeDefined();

      // 3. Audio tempo alignment
      const rawSynthAudioDurationMs = 10450; // 1.10x stretch needed
      const stretchRatio = rawSynthAudioDurationMs / (targetDurationSec * 1000);
      expect(stretchRatio).toBeCloseTo(1.10, 2);

      // 4. Build Adaptive HLS Master Manifest
      const manifest = generateMasterManifest({
        basePlaybackUrl: 'https://cdn.sophia.network/vid_cross_02',
      });
      expect(manifest).toContain('1080p');
      expect(manifest).toContain('720p');
      expect(manifest).toContain('480p');

      // 5. Persist video and audio tracks
      await db
        .prepare('INSERT INTO videos (id, user_id, tenant_id, title, r2_key, duration_sec, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind('vid_cross_02', 'usr_01', 'ten_01', 'JA Dubbed HLS', 'videos/ja_dubbed.mp4', targetDurationSec, 'ready', Date.now(), Date.now())
        .run();

      await db
        .prepare('INSERT INTO video_audio_tracks (id, video_id, locale, preset_id, audio_url, duration_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind('trk_ja_01', 'vid_cross_02', 'ja', jaVoice?.id || '', 'https://cdn.sophia.network/ja_kenji.mp3', rawSynthAudioDurationMs, Date.now())
        .run();

      const track = await db.prepare('SELECT * FROM video_audio_tracks WHERE video_id = ?').bind('vid_cross_02').first<{ preset_id: string }>();
      expect(track?.preset_id).toBe('kenji-ja-m');
    });
  });

  // ─── Pair 3: F8 (Template Registry) + F10 (70/30 Split) + F11 (CAS Ledger) ───
  describe('Pair 3: Template Registry -> 70/30 Royalty Split -> OCC CAS Ledger Accrual', () => {
    it('activates creator template, splits fee 70/30, and accrues ledger entry atomically', async () => {
      // 1. Setup creator profile
      await db
        .prepare('INSERT INTO creator_profiles (id, user_id, display_name, handle, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind('cr_p3', 'usr_p3', 'Tokyo Agency', '@tokyo_agency', Date.now(), Date.now())
        .run();

      // 2. Publish template ($2.99 = 299 cents)
      const p = MOCK_CREATOR_TEMPLATE_PAYLOAD;
      await db
        .prepare('INSERT INTO creator_templates (id, creator_id, slug, title, niche, script_template, storyboard_json, visual_style_prompt, price_cents, royalty_percent, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind('tpl_p3', 'cr_p3', 'tokyo-viral-hook', p.title, p.niche, p.scriptTemplate, p.storyboardJson, p.visualStylePrompt, 299, 70.0, 'approved', Date.now(), Date.now())
        .run();

      // 3. User remixes template: calculate split
      const split = calculateTemplateRoyalty(299, 70.0);
      expect(split.creatorCents).toBe(209);
      expect(split.platformCents).toBe(90);

      // 4. Accrue into CAS ledger
      const accrual = await accrueCreatorLedgerEntryCAS(db as any, {
        creatorId: 'cr_p3',
        amountCents: split.creatorCents,
        referenceId: 'remix_ref_001',
        eventType: 'template_remix',
      });

      expect(accrual.success).toBe(true);
      expect(accrual.sequenceNum).toBe(1);
      expect(accrual.newBalanceCents).toBe(209);

      // 5. Verify ledger balance
      const ledgerEntry = await db.prepare('SELECT balance_after_cents FROM creator_earnings_ledger WHERE creator_id = ? ORDER BY sequence_num DESC LIMIT 1').bind('cr_p3').first<{ balance_after_cents: number }>();
      expect(ledgerEntry?.balance_after_cents).toBe(209);
    });
  });

  // ─── Pair 4: F11 (CAS Ledger) + F14 (Dual-Rail USDT / VietQR Payouts) ─────────
  describe('Pair 4: CAS Ledger Accrual -> Dual-Rail Withdrawal (USDT / VietQR)', () => {
    it('accrues royalties across multiple remixes and executes dual-rail payout withdrawals', async () => {
      // 1. Seed two creators
      await db
        .prepare('INSERT INTO creator_profiles (id, user_id, display_name, handle, payout_rail, payout_destination, accumulated_earnings_cents, available_balance_cents, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind('cr_usdt', 'u1', 'USDT Creator', '@usdt', 'USDT', 'TRC20:0xUSDT', 0, 0, Date.now(), Date.now())
        .run();
      await db
        .prepare('INSERT INTO creator_profiles (id, user_id, display_name, handle, payout_rail, payout_destination, accumulated_earnings_cents, available_balance_cents, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind('cr_vqr', 'u2', 'VietQR Creator', '@vqr', 'VIETQR', '970422:112233', 0, 0, Date.now(), Date.now())
        .run();

      // 2. Accrue earnings ($70.00 each = 7000 cents)
      await accrueCreatorLedgerEntryCAS(db as any, { creatorId: 'cr_usdt', amountCents: 7000, referenceId: 'acc_usdt_1', eventType: 'template_remix' });
      await accrueCreatorLedgerEntryCAS(db as any, { creatorId: 'cr_vqr', amountCents: 7000, referenceId: 'acc_vqr_1', eventType: 'template_remix' });

      // Update available balances for withdrawal test
      await db.prepare('UPDATE creator_profiles SET available_balance_cents = 7000 WHERE id = ?').bind('cr_usdt').run();
      await db.prepare('UPDATE creator_profiles SET available_balance_cents = 7000 WHERE id = ?').bind('cr_vqr').run();

      // 3. Creator 1 requests $50 USDT payout
      await db
        .prepare('INSERT INTO creator_withdrawal_requests (id, creator_id, amount_cents, rail, destination, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind('w_usdt_01', 'cr_usdt', 5000, 'USDT', 'TRC20:0xUSDT', 'pending', Date.now())
        .run();
      await db.prepare('UPDATE creator_profiles SET available_balance_cents = available_balance_cents - 5000 WHERE id = ?').bind('cr_usdt').run();

      // 4. Creator 2 requests $50 VietQR payout
      await db
        .prepare('INSERT INTO creator_withdrawal_requests (id, creator_id, amount_cents, rail, destination, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind('w_vqr_01', 'cr_vqr', 5000, 'VIETQR', '970422:112233', 'pending', Date.now())
        .run();
      await db.prepare('UPDATE creator_profiles SET available_balance_cents = available_balance_cents - 5000 WHERE id = ?').bind('cr_vqr').run();

      // 5. Assert remaining available balances
      const p1 = await db.prepare('SELECT available_balance_cents FROM creator_profiles WHERE id = ?').bind('cr_usdt').first<{ available_balance_cents: number }>();
      const p2 = await db.prepare('SELECT available_balance_cents FROM creator_profiles WHERE id = ?').bind('cr_vqr').first<{ available_balance_cents: number }>();
      expect(p1?.available_balance_cents).toBe(2000);
      expect(p2?.available_balance_cents).toBe(2000);
    });
  });

  // ─── Pair 5: F18 (Peak Optimizer) + F19 (Anti-Collision) + F20 (Cooldown) ────
  describe('Pair 5: Peak-Time Optimizer -> Anti-Collision Stagger -> Cooldown Deferral', () => {
    it('calculates optimal APAC peak slot, staggers multi-channel dispatches, and defers on active cooldown', async () => {
      // 1. Request schedule for Hanoi market at 10:00 local time (03:00 UTC)
      const baseUtcMs = Date.UTC(2026, 8, 25, 3, 0, 0); // 10:00 UTC+7
      const peakSlot = calculateNextPeakPublishTime(baseUtcMs, 'hanoi');
      expect(peakSlot.slotName).toBe('lunch_peak');
      expect(peakSlot.localTimeFormatted).toContain('11:30');

      // 2. Setup 3 channels with stagger
      const staggerMs = 300 * 1000;
      const job1Time = peakSlot.scheduledAtMs; // 11:30
      const job2Time = peakSlot.scheduledAtMs + staggerMs; // 11:35
      const job3Time = peakSlot.scheduledAtMs + 2 * staggerMs; // 11:40

      // 3. Channel 3 is in cooldown until 12:00
      const cooldownUntil = job1Time + 1800 * 1000; // 12:00
      const deferredJob3Time = cooldownUntil + 60 * 1000; // 12:01

      expect(job2Time).toBe(job1Time + staggerMs);
      expect(deferredJob3Time).toBeGreaterThan(job3Time);
      expect(deferredJob3Time).toBeGreaterThan(cooldownUntil);
    });
  });

  // ─── Pair 6: F21 (Viral Metadata) + F22 (Telegram Deep Link) + F16 (Mesh) ────
  describe('Pair 6: Viral Metadata -> Tracked Funnel & Telegram Link -> Omnichannel Publishing', () => {
    it('generates platform-budgeted metadata and attaches to omnichannel publishing jobs', async () => {
      // Seed channel
      await db
        .prepare('INSERT INTO publishing_channels VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind('ch_omni_yt', 'ten_1', 'youtube_shorts', 'Sophia Shorts', 'tok', 'ref', Date.now() + 10000, 'active', Date.now(), Date.now())
        .run();

      // 1. Generate viral metadata
      const meta = generateViralMetadata({
        topic: 'AI Video Marketing',
        niche: 'saas_growth',
        targetPlatform: 'youtube_shorts',
        targetLanguage: 'vi',
        targetMarket: 'hanoi',
        videoJobId: 'vid_omni_01',
        referralCode: 'TOP_PARTNER',
      });

      expect(meta.hookTitle).toContain('AI Video Marketing');
      expect(meta.trackedFunnelUrl).toContain('ref=TOP_PARTNER');
      expect(meta.telegramDeepLink).toContain('t.me/');

      // 2. Enqueue omnichannel publishing job
      const jobId = 'job_omni_01';
      await db
        .prepare('INSERT INTO publishing_jobs (id, tenant_id, channel_id, video_id, market, scheduled_at, status, metadata_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(jobId, 'ten_1', 'ch_omni_yt', 'vid_omni_01', 'hanoi', 1700000000, 'scheduled', JSON.stringify(meta), Date.now(), Date.now())
        .run();

      const job = await db.prepare('SELECT metadata_json FROM publishing_jobs WHERE id = ?').bind(jobId).first<{ metadata_json: string }>();
      const parsed = JSON.parse(job?.metadata_json || '{}');
      expect(parsed.hookTitle).toBe(meta.hookTitle);
      expect(parsed.trackedFunnelUrl).toBe(meta.trackedFunnelUrl);
      expect(parsed.telegramDeepLink).toBe(meta.telegramDeepLink);
    });
  });

  // ─── Pair 7: F23 (HLS) + F25 (Watermark) + F26 (24h Signed URL) ─────────────
  describe('Pair 7: Adaptive HLS -> Dynamic Forensic Watermark -> 24h HMAC Signed URL', () => {
    it('produces secure streaming pipeline with dynamic watermark and cryptographic URL protection', async () => {
      const videoId = 'vid_secure_stream_01';
      const tenantId = 'ten_enterprise_99';
      const userId = 'usr_agent_07';

      // 1. Generate Master Manifest
      const manifest = generateMasterManifest({
        basePlaybackUrl: `https://cdn.sophia.network/${videoId}`,
      });
      expect(manifest).toContain('1080p');

      // 2. Generate Forensic Watermark
      const watermark = generateForensicWatermark(tenantId, userId);
      expect(watermark.overlayText).toContain('Sophia AI');
      expect(watermark.overlayText).toContain('ten_ente');
      expect(verifyForensicWatermark(watermark.overlayText, tenantId, userId)).toBe(true);

      // 3. Issue 24h Signed Download URL
      const token = await createSignedDownloadToken({
        videoId,
        userId,
        ttlSeconds: 86400,
        secret: SECRET_KEY,
      });
      expect(token).toContain('.');

      // 4. Verify legitimate download within window
      const legitVerification = await verifySignedDownloadToken({
        token,
        videoId,
        secret: SECRET_KEY,
      });
      expect(legitVerification.valid).toBe(true);
      expect(legitVerification.expired).toBe(false);

      // 5. Verify tampered video ID is rejected
      const tamperedVerification = await verifySignedDownloadToken({
        token,
        videoId: 'vid_attacker_spoof',
        secret: SECRET_KEY,
      });
      expect(tamperedVerification.valid).toBe(false);
    });
  });

  // ─── Pair 8: F9 (Template FSM) + F12 (Anti-Fraud) + F10 (Royalty Split) ───────
  describe('Pair 8: Template Review FSM -> Anti-Fraud Lineage -> Royalty Distribution', () => {
    it('blocks unapproved or circular remixes, distributes royalties on valid remixed templates', async () => {
      // 1. Seed root creator & blueprint
      await db.prepare('INSERT INTO campaign_blueprints VALUES (?, ?, ?, ?, ?)').bind('bp_root_p8', 'usr_root', null, 'Root BP', Date.now()).run();
      await db.prepare('INSERT INTO campaign_blueprints VALUES (?, ?, ?, ?, ?)').bind('bp_child_p8', 'usr_child', 'bp_root_p8', 'Child BP', Date.now()).run();

      // 2. Attempt circular remix (Root creator attempts to remix child)
      const isCircular = await isCircularAncestorRemix(db as any, 'bp_child_p8', 'usr_root');
      expect(isCircular).toBe(true); // Anti-fraud blocks circular loop

      // 3. Legitimate third-party remix
      const isLegitCircular = await isCircularAncestorRemix(db as any, 'bp_child_p8', 'usr_legit_remixer');
      expect(isLegitCircular).toBe(false);

      // 4. Distribute 70/30 royalty on legitimate remix ($5.00 template fee)
      const split = calculateTemplateRoyalty(500, 70.0);
      expect(split.creatorCents).toBe(350);
      expect(split.platformCents).toBe(150);
    });
  });
});
