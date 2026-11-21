import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { accepted, canonical, dataset, manifest, NOT_MEASURED, replay, sha256 } from './offline-harness.mjs';
const example = () => JSON.parse(execFileSync(process.execPath, [new URL('./run-offline.mjs', import.meta.url).pathname, 'example'], { encoding: 'utf8' }))[0];
test('frozen dataset has 50 concrete cases, category coverage and 300 unique slots', () => {
  assert.equal(sha256(readFileSync(new URL('./dataset-v1.json', import.meta.url), 'utf8')), 'c22beaeebe1b20df3c8c547a5f613ad50cecee413e39d7cb788480fa7405d2d0');
  assert.equal(dataset.cases.length, 50);
  assert.deepEqual(['V', 'E', 'I', 'A'].map(p => dataset.cases.filter(c => c.id.startsWith(p)).length), [20, 10, 10, 10]);
  assert.ok(dataset.cases.every(c => c.brief.length > 30 && c.constraints.length > 20));
  assert.equal(manifest().length, 300);
  assert.equal(new Set(manifest().map(r => `${r.caseId}/${r.repeat}/${r.arm}`)).size, 300);
  assert.equal(manifest().filter(r => r.evaluation === 'controlled-fault').length, 30);
});
test('canonical input hashes ignore object key order, not changed facts', () => {
  assert.equal(canonical({ b: 2, a: 1 }), canonical({ a: 1, b: 2 }));
  assert.notEqual(sha256('25,000'), sha256('35,000'));
});
test('missing evidence never becomes measured success', () => {
  const result = replay([example()]);
  assert.equal(result.missingSlots, 299);
  assert.equal(result.arms.sophia.acceptance.value, NOT_MEASURED);
  assert.equal(result.arms.sophia.inputTokens.value, NOT_MEASURED);
  assert.equal(result.comparablePairs, 0);
});
test('reject duplicate attempts, changed input and live evidence', () => {
  const r = example();
  assert.throws(() => replay([r, r]), /Duplicate/);
  assert.throws(() => replay([{ ...r, inputHash: 'changed' }]), /changed/);
  assert.throws(() => replay([{ ...r, mode: 'live' }]), /Live/);
});
test('reject malformed accounting, output hashes, claims and fake human scores', () => {
  const r = example();
  for (const change of [{ inputTokens: -1 }, { retries: 0.5 }, { output: 'x' }, { mcu: 1 }, { claimsChecked: 1, unsupportedClaims: 2 }, { acceptedMs: 1 }, { humanScores: [{ independent: false }] }]) {
    assert.throws(() => replay([{ ...r, ...change }]));
  }
});
test('independent accepted assets require two reviewers and no critical failures', () => {
  const score = reviewer => ({ reviewer, independent: true, accepted: true, rationale: 'Fixture only', factual: 4, relevance: 5, usefulness: 4, language: 4, compliance: 5 });
  const r = { ...example(), outcome: 'asset', output: 'fixture', outputHash: sha256('fixture'), humanScores: [score('human-1'), score('human-2')], acceptedMs: 1000 };
  assert.equal(accepted(r), true);
  const result = replay([r]);
  assert.equal(result.arms.sophia.acceptance.numerator, 1);
  assert.equal(result.arms.sophia.acceptedTime.denominator, 1);
  assert.equal(result.arms.sophia.weightedQuality.value, 4.35);
  assert.equal(accepted({ ...r, criticalFailures: ['secret leak'] }), false);
  assert.equal(accepted({ ...r, humanScores: [score('human-1')] }), false);
});
test('controlled faults stay outside creative denominators', () => {
  const r = { ...example(), ...manifest().find(r => r.caseId === 'A05'), outcome: 'failure', retries: 0 };
  const result = replay([r]);
  assert.equal(result.controlledFaultRecords, 1);
  assert.equal(result.arms.sophia.acceptance.denominator, 0);
});
const syntheticScore = (reviewer, value = 5) => ({ reviewer, independent: true, accepted: true,
  rationale: 'Synthetic fixture only; not human evaluation evidence',
  factual: value, relevance: value, usefulness: value, language: value, compliance: value });
const syntheticAsset = () => ({ ...example(), outcome: 'asset', output: 'Synthetic artifact only',
  outputHash: sha256('Synthetic artifact only'),
  humanScores: [syntheticScore('synthetic-reviewer-1'), syntheticScore('synthetic-reviewer-2')] });

test('failed or absent artifacts cannot gain quality from perfect synthetic scores', () => {
  const asset = syntheticAsset();
  const failed = { ...asset, outcome: 'failure', output: null, outputHash: NOT_MEASURED };
  for (const arm of ['sophia', 'direct']) {
    const result = replay([{ ...failed, arm }]);
    assert.deepEqual(result.arms[arm].counts, { planned: 135, attempted: 1, completed: 0, valid: 0, reviewed: 0, highQuality: 0 });
    assert.equal(result.arms[arm].scoreAtLeastFour.value, 0);
    assert.equal(result.arms[arm].acceptance.value, 0);
    assert.equal(result.arms[arm].weightedQuality.value, NOT_MEASURED);
    assert.ok(Object.values(result.targetVerdicts).every(value => value === NOT_MEASURED));
  }
  for (const output of [null, '', '   ']) {
    assert.throws(() => replay([{ ...asset, output, outputHash: output === null ? NOT_MEASURED : sha256(output) }]), /Asset requires/);
    assert.equal(accepted({ ...asset, output }), false);
  }
});

test('success requires valid artifact and independent reviews before quality credit', () => {
  const asset = syntheticAsset();
  for (const change of [{ validationErrors: ['Synthetic invalid schema'] }, { criticalFailures: ['Synthetic safety fault'] }]) {
    const result = replay([{ ...asset, ...change }]).arms.sophia;
    assert.equal(result.counts.highQuality, 0);
    assert.equal(result.scoreAtLeastFour.value, 0);
  }
  for (const humanScores of [[], [syntheticScore('synthetic-reviewer-1')]]) {
    const result = replay([{ ...asset, humanScores }]).arms.sophia;
    assert.equal(result.counts.reviewed, 0);
    assert.equal(result.counts.highQuality, 0);
    assert.equal(result.scoreAtLeastFour.value, NOT_MEASURED);
  }
  for (const humanScores of [[null], [syntheticScore(' ')], [{ ...syntheticScore('synthetic'), rationale: ' ' }],
    [syntheticScore('same'), syntheticScore('same')], [{ ...syntheticScore('synthetic'), factual: 6 }]]) {
    assert.throws(() => replay([{ ...asset, humanScores }]));
  }
});

test('synthetic reviewed rubric preserves failed slots and excludes controlled faults', () => {
  const asset = syntheticAsset();
  const failed = { ...example(), repeat: 2, outcome: 'failure', retries: 3 };
  const fault = { ...asset, ...manifest().find(row => row.caseId === 'A05' && row.arm === 'sophia') };
  const result = replay([asset, failed, fault]);
  assert.deepEqual(result.arms.sophia.counts, { planned: 135, attempted: 2, completed: 1, valid: 1, reviewed: 1, highQuality: 1 });
  assert.equal(result.arms.sophia.scoreAtLeastFour.numerator, 1);
  assert.equal(result.arms.sophia.scoreAtLeastFour.denominator, 2);
  assert.equal(result.arms.sophia.scoreAtLeastFour.value, .5);
  assert.equal(result.controlledFaultRecords, 1);
  assert.equal(result.plannedSlots, 300);
  assert.equal(result.missingSlots, 297);
  const below = replay([{ ...asset, humanScores: [syntheticScore('one', 3), syntheticScore('two', 3)] }]);
  assert.equal(below.arms.sophia.counts.highQuality, 0);
  assert.equal(replay([asset]).arms.sophia.scoreAtLeastFour.value, 1);
});

test('measured MCU including zero requires nonblank reference syntax, not reconciliation', () => {
  for (const mcu of [0, 1]) {
    for (const mcuDebitRef of [undefined, null, '', ' ', '\t\n', NOT_MEASURED, ` ${NOT_MEASURED} `]) {
      assert.throws(() => replay([{ ...example(), mcu, mcuDebitRef }]), /ledger evidence/);
    }
    const result = replay([{ ...example(), outcome: 'failure', mcu, mcuDebitRef: 'synthetic-ledger-reference:not-reconciled' }]);
    assert.equal(result.arms.sophia.mcu.value, mcu);
  }
  for (const mcu of [NaN, Infinity, -Infinity, -1, null, '', '0', {}, []]) {
    assert.throws(() => replay([{ ...example(), mcu, mcuDebitRef: 'synthetic-reference' }]), /Invalid mcu/);
  }
});

test('CLI rejects live modes and remote evidence before loading', () => {
  for (const args of [['live'], ['replay', 'https://example.invalid/evidence.json']]) {
    assert.throws(() => execFileSync(process.execPath, [new URL('./run-offline.mjs', import.meta.url).pathname, ...args], { stdio: 'pipe' }));
  }
});
