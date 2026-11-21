import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export const NOT_MEASURED = 'NOT_MEASURED';
export const dataset = JSON.parse(readFileSync(new URL('./dataset-v1.json', import.meta.url), 'utf8'));
export const sha256 = text => createHash('sha256').update(text, 'utf8').digest('hex');
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
export function manifest() {
  return dataset.cases.flatMap(c => [1, 2, 3].flatMap(repeat =>
    ['sophia', 'direct'].map(arm => ({
      dataset: dataset.version, caseId: c.id, repeat, arm,
      evaluation: c.evaluation, expectedOutcome: c.expectedOutcome,
      inputHash: sha256(canonical({ defaults: dataset.defaults, brief: c.brief, constraints: c.constraints })),
    }))));
}
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const numeric = v => v === NOT_MEASURED || (typeof v === 'number' && Number.isFinite(v) && v >= 0);
export function validateRecord(record) {
  assert(record && typeof record === 'object' && !Array.isArray(record), 'Record must be an object');
  const expected = manifest().find(r => r.caseId === record.caseId && r.repeat === record.repeat && r.arm === record.arm);
  assert(expected && record.dataset === dataset.version && record.inputHash === expected.inputHash, 'Unknown or changed case/input');
  assert(record.mode === 'offline-replay', 'Live execution is not supported');
  assert(['asset', 'clarification', 'refusal', 'failure', 'not-run'].includes(record.outcome), 'Invalid outcome');
  for (const key of ['sourceSha', 'sourceDiffHash', 'tenant', 'provider', 'returnedModel', 'promptHash', 'contextHash', 'samplingHash', 'budgetHash', 'evidenceRef']) {
    assert(typeof record[key] === 'string' && record[key].length > 0, `Missing ${key}`);
  }
  assert(record.output === null || typeof record.output === 'string', 'Invalid output');
  assert(record.outcome !== 'asset' || (typeof record.output === 'string' && record.output.trim().length > 0), 'Asset requires recorded output');
  assert(record.output === null ? record.outputHash === NOT_MEASURED : record.outputHash === sha256(record.output), 'Output hash mismatch');
  for (const key of ['inputTokens', 'outputTokens', 'byokCost', 'mcu', 'retries', 'revisions', 'acceptedMs', 'claimsChecked', 'unsupportedClaims']) {
    assert(numeric(record[key]), `Invalid ${key}`);
  }
  for (const key of ['inputTokens', 'outputTokens', 'retries', 'revisions', 'claimsChecked', 'unsupportedClaims']) {
    assert(record[key] === NOT_MEASURED || Number.isInteger(record[key]), `Noninteger ${key}`);
  }
  assert(typeof record.currency === 'string', 'Missing accounting currency');
  assert(record.byokCost === NOT_MEASURED || /^[A-Z]{3}$/.test(record.currency), 'Measured cost requires currency');
  // Reference syntax only: this offline runner cannot reconcile a ledger entry.
  assert(typeof record.mcuDebitRef === 'string' && (record.mcu === NOT_MEASURED ||
    (record.mcuDebitRef.trim().length > 0 && record.mcuDebitRef.trim() !== NOT_MEASURED)), 'Measured MCU requires ledger evidence');
  assert(record.claimsChecked === NOT_MEASURED || record.unsupportedClaims === NOT_MEASURED || record.unsupportedClaims <= record.claimsChecked, 'Invalid claim denominator');
  assert(Array.isArray(record.validationErrors) && record.validationErrors.every(x => typeof x === 'string'), 'Invalid validation errors');
  assert(Array.isArray(record.criticalFailures) && record.criticalFailures.every(x => typeof x === 'string'), 'Invalid critical failures');
  assert(Array.isArray(record.humanScores), 'Missing humanScores');
  for (const score of record.humanScores) {
    assert(score && typeof score === 'object' && !Array.isArray(score), 'Invalid human score');
    assert(score.independent === true && typeof score.reviewer === 'string' && score.reviewer.trim().length > 0, 'Independent human required');
    assert(typeof score.accepted === 'boolean' && typeof score.rationale === 'string' && score.rationale.trim().length > 0, 'Human rationale required');
    for (const key of ['factual', 'relevance', 'usefulness', 'language', 'compliance']) {
      assert(Number.isInteger(score[key]) && score[key] >= 1 && score[key] <= 5, 'Human score outside 1–5');
    }
  }
  assert(new Set(record.humanScores.map(s => s.reviewer)).size === record.humanScores.length, 'Duplicate reviewer');
  assert(record.acceptedMs === NOT_MEASURED || accepted(record), 'Acceptance timing requires independently accepted asset');
  return record;
}
function validAsset(r) {
  return r.outcome === 'asset' && typeof r.output === 'string' && r.output.trim().length > 0 &&
    r.outputHash === sha256(r.output) && r.criticalFailures.length === 0 && r.validationErrors.length === 0;
}
export function accepted(r) {
  return validAsset(r) && r.humanScores.length >= 2 && r.humanScores.every(s => s.accepted);
}
export function replay(records) {
  assert(Array.isArray(records), 'Expected evidence array');
  const seen = new Set();
  for (const record of records) {
    validateRecord(record);
    const key = `${record.caseId}/${record.repeat}/${record.arm}`;
    assert(!seen.has(key), 'Duplicate attempt; retries belong inside attempt accounting');
    seen.add(key);
  }
  const creative = records.filter(r => dataset.cases.find(c => c.id === r.caseId).evaluation === 'creative' && r.outcome !== 'not-run');
  const metric = (key, rows = creative) => {
    const values = rows.map(r => r[key]).filter(v => v !== NOT_MEASURED);
    return { value: values.length ? values.reduce((a, b) => a + b, 0) : NOT_MEASURED, measured: values.length, denominator: rows.length };
  };
  const arms = Object.fromEntries(['sophia', 'direct'].map(arm => {
    const rows = creative.filter(r => r.arm === arm);
    const completed = rows.filter(r => !['failure', 'not-run'].includes(r.outcome));
    const valid = completed.filter(validAsset);
    const rated = valid.filter(r => r.humanScores.length >= 2);
    const planned = manifest().filter(r => r.arm === arm && r.evaluation === 'creative').length;
    const weighted = r => r.humanScores.reduce((s, h) => s + .30 * h.factual + .20 * h.relevance + .20 * h.usefulness + .15 * h.language + .15 * h.compliance, 0) / r.humanScores.length;
    const quality = key => ({ value: rated.length ? rated.reduce((sum, r) => sum + r.humanScores.reduce((s, h) => s + h[key], 0) / r.humanScores.length, 0) / rated.length : NOT_MEASURED, measured: rated.length, denominator: rows.length });
    return [arm, {
      counts: { planned, attempted: rows.length, completed: completed.length, valid: valid.length, reviewed: rated.length, highQuality: rated.filter(r => weighted(r) >= 4).length },
      acceptance: { numerator: rows.filter(accepted).length, denominator: rows.length, value: rows.length ? rows.filter(accepted).length / rows.length : NOT_MEASURED },
      clarification: { numerator: rows.filter(r => r.outcome === 'clarification').length, denominator: rows.length },
      factual: quality('factual'), relevance: quality('relevance'), usefulness: quality('usefulness'),
      weightedQuality: { value: rated.length ? rated.reduce((s, r) => s + weighted(r), 0) / rated.length : NOT_MEASURED, measured: rated.length, denominator: rows.length },
      scoreAtLeastFour: { numerator: rated.filter(r => weighted(r) >= 4 && r.criticalFailures.length === 0).length, denominator: rows.length, measured: rated.length, target: .85, value: rows.length && rated.length === valid.length ? rated.filter(r => weighted(r) >= 4).length / rows.length : NOT_MEASURED },
      byokCostCoverage: { measured: rows.filter(r => r.byokCost !== NOT_MEASURED).length, denominator: rows.length, value: rows.some(r => r.byokCost !== NOT_MEASURED) ? 'SEE_CURRENCY_GROUPS' : NOT_MEASURED },
      ...Object.fromEntries(['inputTokens', 'outputTokens', 'mcu', 'retries', 'revisions', 'claimsChecked', 'unsupportedClaims'].map(k => [k, metric(k, rows)])),
      byokCostByCurrency: Object.fromEntries([...new Set(rows.filter(r => r.byokCost !== NOT_MEASURED).map(r => r.currency))].map(c => [c, metric('byokCost', rows.filter(r => r.currency === c))])),
      acceptedTime: metric('acceptedMs', rows.filter(accepted)),
    }];
  }));
  let comparablePairs = 0;
  for (const r of creative.filter(r => r.arm === 'sophia')) {
    const other = creative.find(o => o.arm === 'direct' && o.caseId === r.caseId && o.repeat === r.repeat);
    if (other && ['provider', 'returnedModel', 'contextHash', 'samplingHash', 'budgetHash'].every(k => r[k] !== NOT_MEASURED && r[k] === other[k])) comparablePairs++;
  }
  return { targetVerdicts: { scoreAtLeastFour85Pct: NOT_MEASURED, usable90Pct: NOT_MEASURED, acceptedTimeP90AtMost15Minutes: NOT_MEASURED, zeroSevereClaimsLeaksUnauthorizedSpendingDuplicateMcu: NOT_MEASURED }, mode: 'offline-replay', proof: 'Fixture mechanics only; not live or end-to-end proof', plannedSlots: 300, providedRecords: records.length, missingSlots: 300 - records.length, controlledFaultRecords: records.filter(r => dataset.cases.find(c => c.id === r.caseId).evaluation === 'controlled-fault').length, comparablePairs, arms };
}
