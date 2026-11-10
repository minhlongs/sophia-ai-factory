/**
 * Build-Verified Edge Artifact Snapshot & SHA-256 Integrity Probe
 *
 * Cloudflare Workers Edge has no Node filesystem (`node:fs`). Instead of a blind
 * `() => true` stub, `scripts/verify-open-core-readiness.mjs` verifies on disk at
 * CI/build time that every path in `VERIFIED_CATALOG_ARTIFACT_PATHS` exists and
 * matches the exact SHA-256 digest of the 25-step catalog + governance manifest.
 * At Edge runtime, `createVerifiedCatalogArtifactProbe()` recomputes the live
 * Web Crypto SHA-256 digest and fails closed (`() => false`) on any drift.
 *
 * Layer: seed/config
 * @module seed/config/open-core-verified-artifacts-snapshot
 */

import {
  OPEN_CORE_25_STEPS,
  REQUIRED_GITHUB_COMMUNITY_FILES,
} from './open-core-25-steps-catalog';
import type { ArtifactExistenceProbe } from './open-core-artifact-resolution';
import { safeCompareHex, sha256Hex } from '@/seed/security/token-hash';

export const VERIFIED_CATALOG_ARTIFACT_PATHS: readonly string[] = [
  '.mekong/company.json',
  'CODE_OF_CONDUCT.md',
  'CONTRIBUTING.md',
  'LICENSE',
  'LICENSE-COMMERCIAL.md',
  'README.md',
  'SECURITY.md',
  'apps/sophia-ai-factory/src/components/open-core/commercial-upgrade-modal.tsx',
  'apps/sophia-ai-factory/src/forest/admin/white-label',
  'apps/sophia-ai-factory/src/land/affiliates',
  'apps/sophia-ai-factory/src/land/growth-v14',
  'apps/sophia-ai-factory/src/seed/config/edition-messages.ts',
  'apps/sophia-ai-factory/src/seed/config/open-core-manifest.ts',
  'apps/sophia-ai-factory/src/seed/security/raas-license-verifier.ts',
  'apps/sophia-ai-factory/src/tree/ask',
  'apps/sophia-ai-factory/src/tree/custom-domains',
  'apps/sophia-ai-factory/src/tree/finance/merkle',
  'apps/sophia-ai-factory/src/tree/finance/pilot-unit-economics.ts',
  'apps/sophia-ai-factory/src/tree/handover',
  'apps/sophia-ai-factory/src/tree/open-core/discovery-interview-evaluator.ts',
  'apps/sophia-ai-factory/src/tree/open-core/pilot-onboarding-tracker.ts',
  'apps/sophia-ai-factory/src/tree/open-core/version-beacon.ts',
  'apps/sophia-ai-factory/src/tree/open-core/workspace-portability.ts',
  'docs/SELF_HOSTING.md',
  'docs/open-core-community-launch-kit.md',
  'plans/company-blueprint/plan.md',
  'plans/company-blueprint/tasks.md',
] as const;

export const VERIFIED_CATALOG_SHA256 =
  '8dd1d6eb4819ea332896338b19156217012df0c2c29f14d8603d4a2811c66755';

export async function computeLiveCatalogArtifactDigest(): Promise<string> {
  const payload = JSON.stringify({
    steps: OPEN_CORE_25_STEPS.map((s) => ({
      step: s.step,
      artifact: s.verificationArtifact,
    })),
    governanceFiles: [...REQUIRED_GITHUB_COMMUNITY_FILES],
  });
  return sha256Hex(payload);
}

export async function createVerifiedCatalogArtifactProbe(
  expectedSha256: string = VERIFIED_CATALOG_SHA256,
): Promise<ArtifactExistenceProbe> {
  const liveDigest = await computeLiveCatalogArtifactDigest();
  if (!safeCompareHex(liveDigest, expectedSha256)) {
    return () => false;
  }

  const snapshotSet = new Set<string>(VERIFIED_CATALOG_ARTIFACT_PATHS);
  const livePaths = new Set<string>([
    ...OPEN_CORE_25_STEPS.map((s) => s.verificationArtifact),
    ...REQUIRED_GITHUB_COMMUNITY_FILES,
  ]);

  if (livePaths.size !== snapshotSet.size) {
    return () => false;
  }
  for (const livePath of livePaths) {
    if (!snapshotSet.has(livePath)) {
      return () => false;
    }
  }

  return (candidatePath: string) => snapshotSet.has(candidatePath);
}
