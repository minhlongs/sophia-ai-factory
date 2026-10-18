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
  'snapshot input identity matched the source repository',
  'proof ran from immutable read-only worktree',
  'source identity matched at run boundaries',
];

function makeEvidence(legacy = false) {
  const gates = gateNames
    .filter((name) => !legacy || name !== 'live and business evidence contract tests')
    .map((name) => ({ name, status: 'passed' }));
  return {
    ...(legacy ? {} : { schema: 'sophia-core-video-deterministic-proof-v4', scope: 'deterministic-mock-tests' }),
    status: 'passed',
    proofMode: true,
    provider: 'mock',
    ...(legacy ? {} : {
      sourceAtStart: { commitSha: 'a'.repeat(40), worktreeFingerprint: 'a'.repeat(64) },
      sourceIdentityMatchedAtBoundaries: true,
      executionMode: 'immutable-readonly-worktree',
    }),
    source: { commitSha: 'a'.repeat(40), worktreeFingerprint: 'a'.repeat(64) },
    ...(!legacy ? { snapshotInputSource: { commitSha: 'a'.repeat(40), worktreeFingerprint: 'a'.repeat(64) } } : {}),
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
  it('accepts the current source-identity proof schema', () => {
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

  it('rejects evidence when source fingerprints differ at run boundaries', () => {
    const evidence = makeEvidence();
    evidence.sourceIdentityMatchedAtBoundaries = false;
    evidence.source.worktreeFingerprint = 'b'.repeat(64);
    const result = runValidator(evidence);

    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain('source fingerprints are valid and match at run boundaries');
  });

  it('rejects a failed proof status even when every gate says passed', () => {
    const evidence = makeEvidence();
    evidence.status = 'failed';
    const result = runValidator(evidence);

    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain('proof run status passed');
  });

  it.each(['sophia-core-video-deterministic-proof-v2', 'sophia-core-video-deterministic-proof-v3'])(
    'rejects %s reports as historical evidence', (schema) => {
    const evidence = makeEvidence();
    evidence.schema = schema;
    const result = runValidator(evidence);

    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain('recognized evidence schema');
    },
  );

  it('rejects current-schema evidence that did not run from an immutable snapshot', () => {
    const evidence = makeEvidence();
    evidence.executionMode = 'mutable-worktree';
    const result = runValidator(evidence);

    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain('immutable source snapshot execution declared');
  });

  it('rejects matching but malformed or missing commit and fingerprint values', () => {
    const evidence = makeEvidence();
    const sourceAtStart = evidence.sourceAtStart;
    if (!sourceAtStart) throw new Error('Expected v3 source start snapshot');
    Reflect.deleteProperty(sourceAtStart, 'commitSha');
    Reflect.deleteProperty(evidence.source, 'commitSha');
    sourceAtStart.worktreeFingerprint = 'z'.repeat(64);
    evidence.source.worktreeFingerprint = 'z'.repeat(64);
    const result = runValidator(evidence);

    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain('source commit identity is valid and matches');
    expect(result.stdout).toContain('source fingerprints are valid and match at run boundaries');
  });

  it('rejects a report that says real provider keys were used', () => {
    const evidence = makeEvidence();
    evidence.realKeysUsed = true;
    const result = runValidator(evidence);

    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain('real provider keys were not used');
  });
});
