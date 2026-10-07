/**
 * SFX Cue Generator.
 * Computes exact timestamps for whooshes, cha-chings, glitches, and alert chimes.
 */

import type { SFXCue, SFXType } from './audio-types';

export interface SFXPlacementInput {
  totalDurationSeconds: number;
  scriptText: string;
  cutTimestamps: number[];
  hasAffiliateCallout?: boolean;
  hasComplianceDisclaimer?: boolean;
}

const SFX_TRIGGER_KEYWORDS: Record<string, SFXType> = {
  // Money / Affiliate / Profit
  money: 'cha_ching',
  commission: 'cha_ching',
  dollar: 'cha_ching',
  revenue: 'cha_ching',
  payout: 'cha_ching',
  free: 'notification_ding',
  bonus: 'notification_ding',
  airdrop: 'notification_ding',
  secret: 'notification_ding',

  // Tech / Disruption / Bug
  hack: 'glitch_hit',
  mistake: 'glitch_hit',
  problem: 'glitch_hit',
  broken: 'glitch_hit',

  // Compliance
  disclaimer: 'compliance_beep',
  risk: 'compliance_beep',
  warning: 'compliance_beep',
};

export function generateSFXCues(input: SFXPlacementInput): SFXCue[] {
  const {
    totalDurationSeconds,
    scriptText,
    cutTimestamps,
    hasAffiliateCallout = true,
    hasComplianceDisclaimer = true,
  } = input;

  const cues: SFXCue[] = [];
  let sfxCounter = 0;

  // 1. Initial Hook Whoosh at t = 0.1s
  cues.push({
    id: `sfx-${++sfxCounter}`,
    type: 'whoosh_fast',
    timestampSeconds: 0.1,
    volume: 0.85,
    reason: 'Intro visual hook burst',
  });

  // 2. Whoosh on visual cuts (every cut timestamp > 0.5s)
  for (const cutTime of cutTimestamps) {
    if (cutTime > 0.8 && cutTime < totalDurationSeconds - 1.5) {
      cues.push({
        id: `sfx-${++sfxCounter}`,
        type: 'whoosh_deep',
        timestampSeconds: Number(cutTime.toFixed(2)),
        volume: 0.7,
        reason: 'Scene transition whoosh',
      });
    }
  }

  // 3. Keyword based SFX mapping based on script text distribution
  const words = scriptText.toLowerCase().split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const cleanWord = words[i].replace(/[^a-z0-9]/g, '');
    const triggerSfx = SFX_TRIGGER_KEYWORDS[cleanWord];

    if (triggerSfx) {
      const approxTime = Number(
        ((i / Math.max(1, words.length)) * totalDurationSeconds).toFixed(2)
      );
      // Avoid clashing with existing cues within 0.4s
      const isClashing = cues.some(
        (c) => Math.abs(c.timestampSeconds - approxTime) < 0.4
      );

      if (!isClashing && approxTime < totalDurationSeconds - 0.5) {
        cues.push({
          id: `sfx-${++sfxCounter}`,
          type: triggerSfx,
          timestampSeconds: approxTime,
          volume: triggerSfx === 'cha_ching' ? 0.9 : 0.75,
          reason: `Keyword trigger: "${cleanWord}"`,
        });
      }
    }
  }

  // 4. Outro CTA Pop/Ding
  if (hasAffiliateCallout && totalDurationSeconds > 3.0) {
    const ctaTime = Number((totalDurationSeconds - 2.0).toFixed(2));
    if (!cues.some((c) => Math.abs(c.timestampSeconds - ctaTime) < 0.5)) {
      cues.push({
        id: `sfx-${++sfxCounter}`,
        type: 'notification_ding',
        timestampSeconds: ctaTime,
        volume: 0.8,
        reason: 'Outro affiliate CTA highlight',
      });
    }
  }

  // Sort cues by timestamp
  return cues.sort((a, b) => a.timestampSeconds - b.timestampSeconds);
}
