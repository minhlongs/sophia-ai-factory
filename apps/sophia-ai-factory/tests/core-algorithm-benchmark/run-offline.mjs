import { readFileSync } from 'node:fs';
import { manifest, NOT_MEASURED, replay } from './offline-harness.mjs';

// No engines, dynamic adapters, credentials, SDKs, subprocesses or network imports.
try {
  const [command, path, ...extra] = process.argv.slice(2);
  if (extra.length || !['manifest', 'example', 'replay'].includes(command)) throw new Error('Usage: node run-offline.mjs manifest|example|replay [local-evidence.json]');
  if (command !== 'replay' && path) throw new Error('Unexpected argument');
  if (command === 'replay' && (!path || /:\/\//.test(path))) throw new Error('Replay requires a local JSON evidence path');
  const example = {
    ...manifest()[0], mode: 'offline-replay', outcome: 'not-run',
    ...Object.fromEntries(['sourceSha', 'sourceDiffHash', 'tenant', 'provider', 'returnedModel', 'promptHash', 'contextHash', 'samplingHash', 'budgetHash', 'outputHash', 'inputTokens', 'outputTokens', 'byokCost', 'currency', 'mcu', 'mcuDebitRef', 'retries', 'revisions', 'acceptedMs', 'claimsChecked', 'unsupportedClaims'].map(k => [k, NOT_MEASURED])),
    evidenceRef: 'example-only:no-execution', output: null, humanScores: [], validationErrors: [], criticalFailures: [],
  };
  const result = command === 'manifest' ? manifest() : command === 'example' ? [example] : replay(JSON.parse(readFileSync(path, 'utf8')));
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
