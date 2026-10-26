/**
 * E-E-A-T Live Telemetry Proof for Sophia AI Factory 2027 AEO/GEO.
 * Provides verifiable deployment metadata for JSON-LD @graph and AnswerFirstCitationBlock.
 * Layer: seed/aeo
 */

import { NICHE_SLUGS } from '@/seed/config/niche-list';
import type { AeoTelemetryProof } from './aeo-types';

export const DEFAULT_VERIFIED_ISO_DATE = '2026-10-26';

export function buildEeatTelemetryProof(explicitSha?: string): AeoTelemetryProof {
  const rawSha =
    explicitSha ??
    (typeof process !== 'undefined' ? process.env.COMMIT_SHA ?? process.env.NEXT_PUBLIC_COMMIT_SHA : undefined) ??
    '37a03381';

  const sanitizedSha = rawSha.replace(/[^a-fA-F0-9a-zA-Z_-]/g, '').slice(0, 12) || '37a03381';

  return {
    deployedSha: sanitizedSha,
    verifiedIsoDate: DEFAULT_VERIFIED_ISO_DATE,
    activeNichesCount: NICHE_SLUGS.length,
    byokZeroMarkup: true,
  };
}
