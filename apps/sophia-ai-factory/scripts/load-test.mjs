#!/usr/bin/env node
/**
 * load-test.mjs — Basic GET load probe for local or explicitly approved staging targets
 * Usage: node scripts/load-test.mjs <url> [concurrency] [requestsPerWorker]
 *
 * Example: node scripts/load-test.mjs http://localhost:3000 10 50
 * Remote staging requires SOPHIA_STAGING_LOAD_CONFIRM=run-staging-load.
 */
import { validateLoadTestTarget } from './load-test-target.mjs';

const args = process.argv.slice(2);

if (args.length < 1 || args.length > 3) {
  console.error('Usage: node scripts/load-test.mjs <local-or-staging-origin> [concurrency 1-50] [requestsPerWorker 1-100]');
  process.exit(1);
}

let url;
try {
  url = validateLoadTestTarget(args[0], process.env.SOPHIA_STAGING_LOAD_CONFIRM);
} catch (error) {
  console.error(`Load target rejected: ${error.message}`);
  process.exit(1);
}
const concurrency = Number(args[1] || '10');
const requestsPerWorker = Number(args[2] || '50');
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 50 ||
    !Number.isInteger(requestsPerWorker) || requestsPerWorker < 1 || requestsPerWorker > 100) {
  console.error('Load bounds rejected: concurrency must be 1-50 and requestsPerWorker must be 1-100.');
  process.exit(1);
}

console.log(`Load test: ${url}`);
console.log(`Concurrency: ${concurrency}, Requests per worker: ${requestsPerWorker}`);
console.log(`Total requests: ${concurrency * requestsPerWorker}`);
console.log('---');

let completed = 0;
let errors = 0;
const durations = [];

function makeRequest() {
  const start = Date.now();
  return fetch(url, { method: 'GET', signal: AbortSignal.timeout(10_000) })
    .then(res => {
      const duration = Date.now() - start;
      durations.push(duration);
      if (!res.ok) {
        errors++;
      }
      completed++;
    })
    .catch(err => {
      errors++;
      completed++;
      console.error('Request error:', err.message);
    });
}

async function worker() {
  for (let i = 0; i < requestsPerWorker; i++) {
    await makeRequest();
  }
}

async function run() {
  const start = Date.now();
  const workers = [];
  for (let i = 0; i < concurrency; i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  const totalTime = Date.now() - start;

  console.log('\n=== Results ===');
  console.log(`Total time: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`Completed: ${completed}`);
  console.log(`Errors: ${errors}`);
  console.log(`Req/sec: ${(completed / (totalTime / 1000)).toFixed(2)}`);

  if (durations.length > 0) {
    durations.sort((a, b) => a - b);
    const p50 = durations[Math.floor(durations.length * 0.5)];
    const p95 = durations[Math.floor(durations.length * 0.95)];
    const p99 = durations[Math.floor(durations.length * 0.99)];
    const max = durations[durations.length - 1];
    console.log(`Latency (ms): p50=${p50} p95=${p95} p99=${p99} max=${max}`);
  }

  process.exit(errors > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
