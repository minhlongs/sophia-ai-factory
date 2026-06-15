#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const SUCCESS_JOB_STATUSES = new Set(['live', 'published', 'completed', 'succeeded']);
const REQUIRED_PASSED_STEPS = [
  'deployment-version',
  'sign-in',
  'save-llm-byok',
  'save-heygen-credential',
  'channel-preflight',
  'openclaw-exchange',
  'auto-video',
  'heygen-completion',
  'video-row',
  'distribution-scheduled',
  'publish-jobs-live',
];
const PREFLIGHT_PASSED_STEPS = [
  'deployment-version',
  'sign-in',
  'save-llm-byok',
  'save-heygen-credential',
  'channel-preflight',
];

function usage() {
  console.log(`Usage:
  npm run verify:user-video-flow:live-evidence -- plans/reports/live-video-proof.json
  npm run verify:user-video-flow:live-evidence -- --preflight plans/reports/live-video-preflight.json

Or:
  SOPHIA_LIVE_EVIDENCE_PATH=plans/reports/live-video-proof.json \\
  npm run verify:user-video-flow:live-evidence`);
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  usage();
  process.exit(0);
}

const preflightMode = process.argv.includes('--preflight');

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

const evidencePath = process.argv.find((arg, index) => index > 1 && arg !== '--preflight') ?? process.env.SOPHIA_LIVE_EVIDENCE_PATH;
if (!evidencePath) {
  usage();
  fail('missing evidence path');
}

let evidence;
try {
  evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
} catch (err) {
  fail(`could not read evidence JSON: ${err instanceof Error ? err.message : String(err)}`);
}

assert(evidence.schema === 'sophia-live-user-video-flow-proof-v1', 'unexpected evidence schema');
const expectedStatus = preflightMode ? 'preflight-passed' : 'passed';
assert(evidence.status === expectedStatus, `evidence status is not ${expectedStatus}: ${evidence.status ?? 'missing'}`);
assert(Array.isArray(evidence.events), 'events must be an array');
assert(evidence.context && typeof evidence.context === 'object', 'context must be an object');

const context = evidence.context;
assert(typeof context.baseUrl === 'string' && context.baseUrl.startsWith('https://'), 'baseUrl missing or not https');
assert(typeof context.deployment?.shortSha === 'string' || typeof context.deployment?.sha === 'string', 'deployment SHA missing');
assert(Array.isArray(context.channelProviders) && context.channelProviders.length >= 2, 'need at least 2 channelProviders');
const byStep = new Map(evidence.events.map((event) => [event.step, event]));
for (const step of preflightMode ? PREFLIGHT_PASSED_STEPS : REQUIRED_PASSED_STEPS) {
  assert(byStep.get(step)?.status === 'passed', `required step not passed: ${step}`);
}

const channelPreflight = byStep.get('channel-preflight')?.data;
assert(
  Array.isArray(channelPreflight?.activeProviders) &&
    context.channelProviders.every((provider) => channelPreflight.activeProviders.includes(provider)),
  'channel preflight did not prove all requested providers active',
);

if (preflightMode) {
  console.log(`LIVE PREFLIGHT EVIDENCE PASS: ${evidencePath}`);
  console.log(`Deployment: ${context.deployment?.shortSha ?? context.deployment?.sha}`);
  console.log(`Providers: ${context.channelProviders.join(',')}`);
  process.exit(0);
}

assert(typeof context.missionId === 'string' && context.missionId.length > 0, 'missionId missing');
assert(typeof context.videoId === 'string' && context.videoId.length > 0, 'videoId missing');
assert(typeof context.heygenJobId === 'string' && context.heygenJobId.length > 0, 'heygenJobId missing');
assert(
  Array.isArray(context.distributionJobIds) &&
    context.distributionJobIds.length >= context.channelProviders.length,
  'distributionJobIds missing or fewer than channelProviders',
);

const heygen = byStep.get('heygen-completion')?.data;
assert(heygen?.status === 'completed' && heygen.videoUrlPresent === true, 'HeyGen completion did not prove completed video URL');

const videoRow = byStep.get('video-row')?.data;
assert(videoRow?.status === 'completed' && videoRow.videoUrlPresent === true, 'video row did not prove completed MP4 URL');

const publish = byStep.get('publish-jobs-live')?.data;
assert(Array.isArray(publish?.jobs), 'publish jobs missing from evidence');
assert(publish.jobs.length >= context.channelProviders.length, 'not enough publish jobs in evidence');
for (const job of publish.jobs) {
  assert(typeof job.provider === 'string' && job.provider.length > 0, `publish job ${job.id ?? 'unknown'} missing provider`);
  assert(SUCCESS_JOB_STATUSES.has(job.status), `publish job ${job.id ?? 'unknown'} status not successful: ${job.status}`);
}

console.log(`LIVE EVIDENCE PASS: ${evidencePath}`);
console.log(`Deployment: ${context.deployment?.shortSha ?? context.deployment?.sha}`);
console.log(`Video: ${context.videoId}`);
console.log(`Publish jobs: ${publish.jobs.length}`);
