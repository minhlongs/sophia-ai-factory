/**
 * @module land/affiliates/scout/scoring/risk-evaluator
 * Risk evaluator for affiliate offers including scam detection and crypto volume caps.
 */

import type { Affiliate } from '../types';
import { detectScamRisk, type ScamDetectionResult } from '../scam-detector';
import {
  type ScoringContext,
  SCAM_RISK_FAIL_THRESHOLD,
  CRYPTO_VOLUME_THRESHOLD_USD,
} from './types';

export function evaluateRisk(
  affiliate: Affiliate,
  ctx?: ScoringContext,
): {
  scamDetection: ScamDetectionResult;
  isScamBlocked: boolean;
  applyCryptoPenalty: (rawScore: number) => number;
} {
  const scamDetection = ctx?.skipScamCheck
    ? {
        scamRisk: 0,
        breakdown: {
          blacklistedDomain: 0,
          suspiciousTld: 0,
          mlmKeywords: 0,
          scamPhrases: 0,
          copycatBrand: 0,
        },
        signals: [],
      }
    : detectScamRisk(affiliate);

  const isScamBlocked = scamDetection.scamRisk >= SCAM_RISK_FAIL_THRESHOLD;

  const cryptoVol = affiliate.cryptoVolumeUsd;
  const applyCryptoPenalty = (rawScore: number): number => {
    if (cryptoVol != null && cryptoVol < CRYPTO_VOLUME_THRESHOLD_USD) {
      return Math.min(rawScore, 0.8);
    }
    return rawScore;
  };

  return {
    scamDetection,
    isScamBlocked,
    applyCryptoPenalty,
  };
}
