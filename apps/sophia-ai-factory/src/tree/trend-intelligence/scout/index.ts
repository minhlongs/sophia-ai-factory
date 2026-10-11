/**
 * Trend Scout Submodule Index
 *
 * Layer: tree (domain reusable)
 *
 * @module tree/trend-intelligence/scout
 */

export * from './types';
export { seededRandom, generateEvidencePoints } from './velocity-scorer';
export { deriveHashtags, buildCandidateTopics } from './cluster-matcher';
export { scoutTrendingSignals } from './trend-scout-service';
