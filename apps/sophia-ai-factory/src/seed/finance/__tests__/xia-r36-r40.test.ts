import { describe, expect, it } from 'vitest';
import { planAudioLoudnessNormalization } from '@/seed/video/audio-loudness-normalizer';
import {
  encodeTamperEvidentSubId,
  verifyTamperEvidentSubId,
} from '@/seed/affiliate/subid-watermark-encoder';
import { computeOptimalPublishWindow } from '@/seed/growth/optimal-publish-window';
import { injectLocalizedDisclosure } from '@/seed/compliance/ftc-disclosure-injector';
import { reconcileAffiliatePayoutThreeWay } from '@/seed/finance/affiliate-payout-reconciler';

describe('Rounds 36–40 Clean-Room Moat Cores', () => {
  it('R36: plans -14 LUFS normalization and flags true-peak clipping fail-closed', () => {
    const normal = planAudioLoudnessNormalization({
      platform: 'tiktok',
      measuredLufs: -17,
      truePeakDbtp: -5,
      bgmOffsetDb: -18,
    });
    expect(normal.status).toBe('needs_normalization');
    expect(normal.recommendedGainDb).toBe(3);

    const clip = planAudioLoudnessNormalization({
      platform: 'instagram_reels',
      measuredLufs: -20,
      truePeakDbtp: -2,
      bgmOffsetDb: -10,
    });
    expect(clip.status).toBe('clipping_risk');
    expect(clip.limiterRequired).toBe(true);
    expect(clip.bgmDuckingDb).toBe(-18);
  });

  it('R37: encodes and verifies tamper-evident SubIDs and rejects forged segments', () => {
    const subId = encodeTamperEvidentSubId(
      { campaignId: 'camp_01', creatorId: 'u_99', variantId: 'hookB' },
      'secret-salt',
    );
    expect(verifyTamperEvidentSubId(subId, 'secret-salt').valid).toBe(true);
    expect(verifyTamperEvidentSubId(`${subId}x`, 'secret-salt').valid).toBe(false);
    expect(verifyTamperEvidentSubId(subId, 'wrong-salt').valid).toBe(false);
  });

  it('R38: computes next multi-timezone peak publish window cleanly', () => {
    const vn = computeOptimalPublishWindow({
      region: 'VN',
      platform: 'tiktok',
      currentUtcHour: 10, // 17:00 VN -> next peak 19:00 VN (12:00 UTC)
    });
    expect(vn.localPeakHour).toBe(19);
    expect(vn.utcPublishHour).toBe(12);
    expect(vn.hoursUntilSlot).toBe(2);
  });

  it('R39: idempotently injects localized FTC/VN disclosure without double-injecting', () => {
    const first = injectLocalizedDisclosure({
      caption: 'So sánh phí giao dịch 2026',
      jurisdiction: 'VN',
      vertical: 'crypto',
    });
    expect(first.injected).toBe(true);
    expect(first.caption).toContain('Liên kết tiếp thị');

    const second = injectLocalizedDisclosure({
      caption: first.caption,
      jurisdiction: 'VN',
      vertical: 'crypto',
    });
    expect(second.injected).toBe(false);
  });

  it('R40: reconciles 3-way S2S payouts in exact BigInt cents and detects drift', () => {
    const ok = reconcileAffiliatePayoutThreeWay({
      networkReportedCents: 100_000n,
      ledgerRecordedCents: 100_000n,
      settledBankCents: 100_000n,
      clawbackReserveBps: 500,
    });
    expect(ok.status).toBe('reconciled');
    expect(ok.recommendedReserveCents).toBe(5_000n);
    expect(ok.releasableNetCents).toBe(95_000n);

    const drift = reconcileAffiliatePayoutThreeWay({
      networkReportedCents: 100_000n,
      ledgerRecordedCents: 99_500n,
      settledBankCents: 99_000n,
      clawbackReserveBps: 500,
    });
    expect(drift.status).toBe('discrepancy_detected');
    expect(drift.postbackVsLedgerDeltaCents).toBe(500n);
    expect(drift.ledgerVsSettledDeltaCents).toBe(500n);
  });
});
