import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const scriptPath = resolve('scripts/verify-core-video-factory-evidence.mjs');
const tempDirs: string[] = [];
const gateNames = [
  'mock provider safety tests',
  'proof flow integration tests',
  'live and business evidence contract tests',
  'TypeScript compile',
  'ESLint zero-error gate',
];

function makeEvidence(legacy = false) {
  const gates = gateNames
    .filter((name) => !legacy || name !== 'live and business evidence contract tests')
    .map((name) => ({ name, status: 'passed' }));
  return {
    ...(legacy ? {} : { schema: 'sophia-core-video-deterministic-proof-v2', scope: 'deterministic-mock-tests' }),
    status: 'passed',
    proofMode: true,
    provider: 'mock',
    source: { worktreeFingerprint: 'a'.repeat(64) },
    gates,
    realKeysUsed: false,
    ...(legacy ? {
      artifacts: {
        videoUrl: 'https://mock.sophia.local/video.mp4',
        videoStatus: 'completed',
      },
    } : {
      liveProviderValidated: false,
      checkoutValidated: false,
      livePayoutValidated: false,
      productionPublishValidated: false,
      productionSloValidated: false,
      commercialUnitEconomicsValidated: false,
    }),
  };
}

function runValidator(evidence: unknown) {
  const dir = mkdtempSync(join(tmpdir(), 'sophia-core-proof-'));
  tempDirs.push(dir);
  const path = join(dir, 'proof.json');
  writeFileSync(path, `${JSON.stringify(evidence, null, 2)}\n`);
  return spawnSync(process.execPath, [scriptPath, path], { encoding: 'utf8', cwd: resolve('.') });
}

afterEach(() => {
  while (tempDirs.length > 0) rmSync(tempDirs.pop()!, { recursive: true, force: true });
});

describe('verify-core-video-factory-evidence', () => {
  it('accepts the current deterministic-only proof schema', () => {
    const result = runValidator(makeEvidence());

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('DETERMINISTIC MOCK EVIDENCE VALID');
    expect(result.stdout).toContain('unit economics remain unproven');
  });

  it('accepts legacy evidence as mock-only without calling it complete', () => {
    const result = runValidator(makeEvidence(true));

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('LEGACY MOCK EVIDENCE VALID');
  });

  it('rejects current evidence with a missing gate', () => {
    const evidence = makeEvidence();
    evidence.gates = evidence.gates.filter((gate) => gate.name !== 'proof flow integration tests');
    const result = runValidator(evidence);

    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain('all required deterministic gates passed');
    expect(result.stdout).toContain('[FAIL]');
  });
});
