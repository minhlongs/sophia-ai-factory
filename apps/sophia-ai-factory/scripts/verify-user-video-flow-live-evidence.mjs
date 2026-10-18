#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const SUCCESS_JOB_STATUSES = new Set(['live', 'published', 'completed', 'succeeded']);
const CURRENT_SCHEMA = 'sophia-live-user-video-flow-proof-v4';
const LEGACY_SCHEMAS = new Set([
  'sophia-live-user-video-flow-proof-v1',
  'sophia-live-user-video-flow-proof-v2',
  'sophia-live-user-video-flow-proof-v3',
]);
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

assert(evidence.schema === CURRENT_SCHEMA || LEGACY_SCHEMAS.has(evidence.schema), 'unexpected evidence schema');
const expectedStatus = preflightMode ? 'preflight-passed' : 'passed';
assert(evidence.status === expectedStatus, `evidence status is not ${expectedStatus}: ${evidence.status ?? 'missing'}`);
assert(Array.isArray(evidence.events), 'events must be an array');
assert(evidence.context && typeof evidence.context === 'object', 'context must be an object');

const context = evidence.context;
assert(typeof context.baseUrl === 'string' && context.baseUrl.startsWith('https://'), 'baseUrl missing or not https');
assert(typeof context.deployment?.shortSha === 'string' || typeof context.deployment?.sha === 'string', 'deployment SHA missing');
if (evidence.schema === CURRENT_SCHEMA) {
  assert(typeof context.runId === 'string' && context.runId.length > 0, 'runId missing');
  assert(/^[a-f0-9]{40,64}$/i.test(context.deployment?.sha ?? ''), 'full deployment commit SHA missing');
  assert(context.deployment.sha.slice(0, 8).toLowerCase() === context.deployment.shortSha?.toLowerCase(), 'full and short deployment SHAs do not match');
}
assert(Array.isArray(context.channelProviders) && context.channelProviders.length >= 2, 'need at least 2 channelProviders');
const byStep = new Map(evidence.events.map((event) => [event.step, event]));
const requiredSteps = preflightMode
  ? PREFLIGHT_PASSED_STEPS
  : evidence.schema === CURRENT_SCHEMA
    ? [...REQUIRED_PASSED_STEPS, 'video-full-decode']
    : evidence.schema === 'sophia-live-user-video-flow-proof-v3'
      ? [...REQUIRED_PASSED_STEPS, 'video-range-mp4-header']
    : REQUIRED_PASSED_STEPS;
for (const step of requiredSteps) {
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

if (evidence.schema === CURRENT_SCHEMA && !preflightMode) {
  const artifact = byStep.get('video-full-decode')?.data;
  assert(artifact?.status === 200, 'video artifact did not prove a complete HTTP download');
  assert(artifact?.fullDecode === true, 'video artifact did not prove a full audio/video decode');
  assert(Number.isSafeInteger(artifact?.totalBytes) && artifact.totalBytes > 0, 'video artifact size is missing');
  assert(/^[a-f0-9]{64}$/i.test(artifact?.sha256 ?? ''), 'video artifact SHA-256 is missing');
  assert(typeof artifact?.formatName === 'string' && artifact.formatName.length > 0, 'video container metadata is missing');
  assert(Number.isFinite(artifact?.durationSec) && artifact.durationSec > 0, 'video duration is missing');
  assert(Array.isArray(artifact?.videoStreams) && artifact.videoStreams.length > 0, 'decoded video stream metadata is missing');
  assert(Array.isArray(artifact?.audioStreams), 'audio stream metadata is missing');
} else if (evidence.schema === 'sophia-live-user-video-flow-proof-v3' && !preflightMode) {
  const artifact = byStep.get('video-range-mp4-header')?.data;
  assert(artifact?.status === 206, 'video artifact did not prove byte-range support');
  assert(artifact?.mp4Brand === 'ftyp', 'video artifact did not prove a valid MP4 header');
  assert(Number.isFinite(artifact?.totalBytes) && artifact.totalBytes > 0, 'video artifact size is missing');
}

const publish = byStep.get('publish-jobs-live')?.data;
assert(Array.isArray(publish?.jobs), 'publish jobs missing from evidence');
assert(publish.jobs.length >= context.channelProviders.length, 'not enough publish jobs in evidence');
for (const job of publish.jobs) {
  assert(typeof job.provider === 'string' && job.provider.length > 0, `publish job ${job.id ?? 'unknown'} missing provider`);
  assert(SUCCESS_JOB_STATUSES.has(job.status), `publish job ${job.id ?? 'unknown'} status not successful: ${job.status}`);
}

const isLegacy = LEGACY_SCHEMAS.has(evidence.schema);
console.log(`${isLegacy ? 'LEGACY LIVE VIDEO EVIDENCE PASS' : 'LIVE VIDEO EVIDENCE PASS'}: ${evidencePath}`);
console.log(`Deployment: ${context.deployment?.shortSha ?? context.deployment?.sha}`);
console.log(`Video: ${context.videoId}`);
console.log(`Publish jobs: ${publish.jobs.length}`);
if (isLegacy) {
  console.log('Legacy video evidence does not prove a full media download or decode.');
}
