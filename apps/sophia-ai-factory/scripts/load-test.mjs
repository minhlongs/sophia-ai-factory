#!/usr/bin/env node
/**
 * load-test.mjs — Basic load testing for production endpoints
 * Usage: node scripts/load-test.mjs <url> [concurrency] [requestsPerWorker]
 *
 * Example: node scripts/load-test.mjs https://sophia.agencyos.network 10 100
 */

const args = process.argv.slice(2);

if (args.length < 1) {
  console.error('Usage: load-test.mjs <url> [concurrency] [requestsPerWorker]');
  process.exit(1);
}

const url = args[0];
const concurrency = parseInt(args[1] || '10');
const requestsPerWorker = parseInt(args[2] || '50');

console.log(`Load test: ${url}`);
console.log(`Concurrency: ${concurrency}, Requests per worker: ${requestsPerWorker}`);
console.log(`Total requests: ${concurrency * requestsPerWorker}`);
console.log('---');

let completed = 0;
let errors = 0;
const durations = [];

function makeRequest() {
  const start = Date.now();
  return fetch(url, { method: 'GET' })
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
