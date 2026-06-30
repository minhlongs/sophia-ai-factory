/**
 * @module forest/usage-metering
 *
 * Canonical usage-metering code lives in @/tree/usage-metering.
 * Forest re-exports from tree (forest → tree is allowed by 4-layer architecture).
 *
 * This eliminates the pre-existing 35-file byte-identical duplication (2026-06-30).
 * Tests remain in forest/__tests__/.
 */
export * from '@/tree/usage-metering';
