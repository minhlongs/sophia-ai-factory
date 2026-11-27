import { describe, expect, it } from 'vitest';
import { chunkWordsIntoKineticBeats } from '@/seed/video/kinetic-captions';
import { detectOfferDrift } from '@/seed/affiliate/offer-drift-detector';
import { evaluateCommentToDmTrigger } from '@/seed/growth/comment-to-dm-fsm';
import {
  planZeroDowntimeKekRotation,
  redactSecretsInText,
} from '@/seed/security/byok-key-rotation';
import { computeCrossBorderPayoutTax } from '@/seed/finance/cross-border-payout-tax';

describe('Rounds 26–30 Clean-Room Moat Cores', () => {
  it('R26: chunks words into 2-4 word kinetic karaoke beats with ASS \\k tags', () => {
    const beats = chunkWordsIntoKineticBeats([
      { text: 'Stop', startMs: 0, endMs: 300 },
      { text: 'losing', startMs: 300, endMs: 650 },
      { text: 'fees!', startMs: 650, endMs: 1000 },
      { text: 'Switch', startMs: 2000, endMs: 2400 },
      { text: 'now', startMs: 2400, endMs: 2800 },
    ]);
    expect(beats.length).toBe(2);
    expect(beats[0].assKaraokeLine).toContain('{\\k30}Stop');
    expect(beats[1].words.map((w) => w.text)).toEqual(['Switch', 'now']);
  });

  it('R27: detects commission cuts, cookie shrinkage, and program shutdowns deterministically', () => {
    const alerts = detectOfferDrift(
      { offerId: 'o1', programName: 'SaaS X', commissionBps: 3000, cookieWindowDays: 60, httpStatus: 200, tosHash: 'a' },
      { offerId: 'o1', programName: 'SaaS X', commissionBps: 1500, cookieWindowDays: 30, httpStatus: 410, tosHash: 'b' },
    );
    expect(alerts.map((a) => a.kind)).toEqual([
      'PROGRAM_SHUTDOWN',
      'COMMISSION_CUT',
      'COOKIE_WINDOW_SHRUNK',
      'TOS_CHANGED',
    ]);
  });

  it('R28: matches Vietnamese/English comment keywords and enforces Meta 750/hr & 24h rules', () => {
    const ok = evaluateCommentToDmTrigger({
      commentText: 'Gửi mình hướng dẫn CRYPTO nhé!',
      keywords: ['crypto'],
      repliesSentLastHour: 10,
      hoursSinceComment: 1,
    });
    expect(ok.state).toBe('QUEUED_FOR_DM');

    const capped = evaluateCommentToDmTrigger({
      commentText: 'crypto',
      keywords: ['crypto'],
      repliesSentLastHour: 750,
      hoursSinceComment: 1,
    });
    expect(capped.state).toBe('DEFERRED_RATE_LIMIT');
  });

  it('R29: plans zero-downtime KEK rotation and redacts API keys cleanly', () => {
    const plan = planZeroDowntimeKekRotation([
      { version: 1, state: 'decrypt_only', rowsEncrypted: 0 },
      { version: 2, state: 'decrypt_only', rowsEncrypted: 42 },
      { version: 3, state: 'active', rowsEncrypted: 100 },
    ]);
    expect(plan.activeVersion).toBe(3);
    expect(plan.rowsNeedingRewrap).toBe(42);
    expect(plan.safeToRetireVersions).toEqual([1]);

    expect(redactSecretsInText('Bearer sk-or-v1-1234567890abcdef123456')).toBe('Bearer [REDACTED_SECRET]');
  });

  it('R30: computes exact BigInt withholding tax and balanced net payout across rails', () => {
    const breakdown = computeCrossBorderPayoutTax({
      grossMinorUnits: 100_000n,
      withholdingTaxBps: 1000,
      rail: 'PAYOS_VND',
    });
    expect(breakdown.balanced).toBe(true);
    expect(breakdown.taxWithheldMinorUnits).toBe(10_000n);
    expect(breakdown.netPayoutMinorUnits).toBe(90_000n);
  });
});
