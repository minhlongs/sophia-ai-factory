/**
 * Deterministic Pre-Export Video Script Eval Gate (Harness Quality Layer).
 *
 * Scores an `AffiliateCampaignPack` from 0 to 100 across 4 measurable criteria:
 * 1. Hook 3s punchiness (concise, high-retention opening)
 * 2. Voice-to-Duration pacing (words per second within natural VI/EN speaking range)
 * 3. Affiliate compliance (verbatim referralUrl + disclosure present)
 * 4. GEO / AEO structure (multiple structured chapters/scenes for AI citation)
 *
 * @module tree/harness/video-script-eval-gate
 */

import type { AffiliateCampaignPack } from '@/seed/ai/affiliate-campaign-prompt';

export interface EvalGateCheck {
  readonly id: 'hook_3s' | 'voice_pacing' | 'affiliate_compliance' | 'geo_structure';
  readonly passed: boolean;
  readonly score: number;
  readonly maxScore: number;
  readonly detail: string;
}

export interface VideoScriptEvalReport {
  readonly totalScore: number;
  readonly status: 'PASS' | 'WARN';
  readonly checks: readonly EvalGateCheck[];
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function evaluateAffiliateCampaignPack(
  pack: AffiliateCampaignPack,
): VideoScriptEvalReport {
  const hookWords = countWords(pack.hook);
  const hookPassed = hookWords >= 4 && hookWords <= 28;
  const hookCheck: EvalGateCheck = {
    id: 'hook_3s',
    passed: hookPassed,
    score: hookPassed ? 25 : 10,
    maxScore: 25,
    detail: hookPassed
      ? `${hookWords} words (optimal 3s hook)`
      : `${hookWords} words (recommended 4–28 words for 3s hook)`,
  };

  const scenes = pack.shortFormScript.scenes;
  const totalWords = scenes.reduce((sum, s) => sum + countWords(s.narration), 0);
  const totalDur = Math.max(1, pack.shortFormScript.total_duration || 30);
  const wps = Number((totalWords / totalDur).toFixed(2));
  const pacingPassed = wps >= 1.2 && wps <= 3.8;
  const pacingCheck: EvalGateCheck = {
    id: 'voice_pacing',
    passed: pacingPassed,
    score: pacingPassed ? 25 : 10,
    maxScore: 25,
    detail: pacingPassed
      ? `${wps} words/sec (natural voice pacing)`
      : `${wps} words/sec (target 1.2–3.8 words/sec)`,
  };

  const hasReferral =
    pack.callToAction.includes(pack.referralUrl) &&
    pack.socialPost.includes(pack.referralUrl);
  const hasDisclosure = pack.affiliateDisclosure.trim().length >= 8;
  const compliancePassed = hasReferral && hasDisclosure;
  const complianceCheck: EvalGateCheck = {
    id: 'affiliate_compliance',
    passed: compliancePassed,
    score: compliancePassed ? 25 : 0,
    maxScore: 25,
    detail: compliancePassed
      ? 'Verified referral link + disclosure present'
      : 'Missing verbatim referral link or disclosure',
  };

  const geoPassed = scenes.length >= 3 && pack.valueProposition.trim().length >= 20;
  const geoCheck: EvalGateCheck = {
    id: 'geo_structure',
    passed: geoPassed,
    score: geoPassed ? 25 : 10,
    maxScore: 25,
    detail: geoPassed
      ? `${scenes.length} structured chapters ready for AI citation`
      : `Only ${scenes.length} scene(s) — add >= 3 chapters for GEO`,
  };

  const checks: readonly EvalGateCheck[] = [
    hookCheck,
    pacingCheck,
    complianceCheck,
    geoCheck,
  ];
  const totalScore = checks.reduce((sum, c) => sum + c.score, 0);

  return {
    totalScore,
    status: totalScore >= 75 ? 'PASS' : 'WARN',
    checks,
  };
}
