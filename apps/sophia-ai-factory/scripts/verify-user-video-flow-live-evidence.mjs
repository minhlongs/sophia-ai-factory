#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { isMp4Brand, isMp4FormatName } from './live-proof/media.mjs';

const SUCCESS_JOB_STATUSES = new Set(['live', 'published', 'completed', 'succeeded']);
const CURRENT_SCHEMA = 'sophia-live-user-video-flow-proof-v8';
const REQUIRED_PASSED_STEPS = [
  'deployment-version',
  'sign-in',
  'authenticated-principal',
  'save-llm-byok',
  'save-heygen-credential',
  'channel-preflight',
  'openclaw-exchange',
  'auto-video',
  'mission-start-row',
  'heygen-completion',
  'video-row',
  'distribution-scheduled',
  'publish-jobs-live',
];
const PREFLIGHT_PASSED_STEPS = [
  'deployment-version',
  'sign-in',
  'authenticated-principal',
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

assert(evidence.schema === CURRENT_SCHEMA, 'only v8 account-bound, job/channel-correlated full-decode evidence can pass this validator');
const expectedStatus = preflightMode ? 'preflight-passed' : 'passed';
assert(evidence.status === expectedStatus, `evidence status is not ${expectedStatus}: ${evidence.status ?? 'missing'}`);
assert(Array.isArray(evidence.events), 'events must be an array');
assert(evidence.context && typeof evidence.context === 'object', 'context must be an object');

const context = evidence.context;
assert(typeof context.baseUrl === 'string' && context.baseUrl.startsWith('https://'), 'baseUrl missing or not https');
assert(typeof context.deployment?.shortSha === 'string' || typeof context.deployment?.sha === 'string', 'deployment SHA missing');
assert(typeof context.runId === 'string' && context.runId.length > 0, 'runId missing');
assert(/^[a-f0-9]{40,64}$/i.test(context.deployment?.sha ?? ''), 'full deployment commit SHA missing');
assert(context.deployment.sha.slice(0, 8).toLowerCase() === context.deployment.shortSha?.toLowerCase(), 'full and short deployment SHAs do not match');
assert(/^[a-f0-9]{64}$/i.test(context.accountRefHash ?? ''), 'authenticated account reference hash missing');
assert(
  Array.isArray(context.channelProviders) && (preflightMode || context.channelProviders.length >= 2) &&
    context.channelProviders.every((provider) => typeof provider === 'string' && provider.length > 0) &&
    new Set(context.channelProviders).size === context.channelProviders.length,
  preflightMode ? 'preflight channelProviders must be distinct non-empty strings' : 'need at least 2 distinct channelProviders',
);
const byStep = new Map(evidence.events.map((event) => [event.step, event]));
const requiredSteps = preflightMode ? PREFLIGHT_PASSED_STEPS : [...REQUIRED_PASSED_STEPS, 'video-full-decode'];
if (!preflightMode) requiredSteps.push('paid-entitlement');
for (const step of requiredSteps) {
  assert(byStep.get(step)?.status === 'passed', `required step not passed: ${step}`);
}
assert(byStep.get('authenticated-principal')?.data?.accountRefHash === context.accountRefHash, 'authenticated principal hash does not match context');

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

assert(['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'].includes(context.expectedTier), 'expected paid tier missing or invalid');
assert(
  byStep.get('paid-entitlement')?.data?.userTier === context.expectedTier &&
    byStep.get('paid-entitlement')?.data?.accountRefHash === context.accountRefHash,
  'video proof did not bind the expected paid entitlement to the authenticated account',
);

assert(typeof context.missionId === 'string' && context.missionId.length > 0, 'missionId missing');
assert(typeof context.videoId === 'string' && context.videoId.length > 0, 'videoId missing');
assert(typeof context.heygenJobId === 'string' && context.heygenJobId.length > 0, 'heygenJobId missing');
assert(Number.isFinite(Date.parse(context.serverMissionStartedAt ?? '')), 'server mission start timestamp missing');
assert(Number.isFinite(Date.parse(context.serverVideoCreatedAt ?? '')), 'server-created video timestamp missing');
const autoVideo = byStep.get('auto-video')?.data;
assert(
  autoVideo?.missionId === context.missionId && autoVideo?.videoId === context.videoId &&
    autoVideo?.heygenJobId === context.heygenJobId,
  'auto-video response identities do not match proof context',
);
assert(
  Array.isArray(context.distributionJobIds) &&
    context.distributionJobIds.length === context.channelProviders.length &&
    context.distributionJobIds.every((jobId) => typeof jobId === 'string' && jobId.length > 0) &&
    new Set(context.distributionJobIds).size === context.distributionJobIds.length,
  'distributionJobIds must contain one unique job per requested channel provider',
);

const heygen = byStep.get('heygen-completion')?.data;
assert(heygen?.status === 'completed' && heygen.videoUrlPresent === true, 'HeyGen completion did not prove completed video URL');
assert(heygen.heygenJobId === context.heygenJobId, 'HeyGen completion job ID does not match proof context');

const videoRow = byStep.get('video-row')?.data;
assert(videoRow?.status === 'completed' && videoRow.videoUrlPresent === true, 'video row did not prove completed MP4 URL');
assert(videoRow.videoId === context.videoId, 'video row ID does not match proof context');
assert(Date.parse(videoRow.serverCreatedAt ?? '') === Date.parse(context.serverVideoCreatedAt), 'video row timestamp does not match proof context');
const missionStart = byStep.get('mission-start-row')?.data;
assert(missionStart?.missionId === context.missionId && missionStart.command === 'auto-video', 'mission start row identity does not match context');
assert(Date.parse(missionStart.serverStartedAt ?? '') === Date.parse(context.serverMissionStartedAt), 'mission start event timestamp does not match proof context');

if (!preflightMode) {
  const artifact = byStep.get('video-full-decode')?.data;
  assert(artifact?.status === 200, 'video artifact did not prove a complete HTTP download');
  assert(artifact?.fullDecode === true, 'video artifact did not prove a full audio/video decode');
  assert(Number.isSafeInteger(artifact?.totalBytes) && artifact.totalBytes > 0, 'video artifact size is missing');
  assert(/^[a-f0-9]{64}$/i.test(artifact?.sha256 ?? ''), 'video artifact SHA-256 is missing');
  assert(typeof artifact?.majorBrand === 'string' && artifact.majorBrand.length === 4, 'video MP4 major brand is missing');
  assert(isMp4Brand(artifact?.compatibleMp4Brand), 'video artifact does not prove an MP4-compatible brand');
  assert(isMp4FormatName(artifact?.formatName), 'video container metadata does not identify MP4');
  assert(Number.isFinite(artifact?.durationSec) && artifact.durationSec > 0, 'video duration is missing');
  assert(Array.isArray(artifact?.videoStreams) && artifact.videoStreams.length > 0, 'decoded video stream metadata is missing');
  assert(Array.isArray(artifact?.audioStreams), 'audio stream metadata is missing');
}

const publish = byStep.get('publish-jobs-live')?.data;
assert(Array.isArray(publish?.jobs), 'publish jobs missing from evidence');
assert(publish.jobs.length >= context.channelProviders.length, 'not enough publish jobs in evidence');
const scheduled = byStep.get('distribution-scheduled')?.data;
assert(
  Array.isArray(scheduled?.jobIds) &&
    scheduled.jobIds.length === context.distributionJobIds.length &&
    context.distributionJobIds.every((jobId) => scheduled.jobIds.includes(jobId)),
  'scheduled job IDs do not match proof context',
);
assert(
  Array.isArray(scheduled?.expectedProviders) &&
    scheduled.expectedProviders.length === context.channelProviders.length &&
    context.channelProviders.every((provider) => scheduled.expectedProviders.includes(provider)),
  'scheduled providers do not match requested channel providers',
);
assert(
  Array.isArray(scheduled?.expectedJobs) &&
    scheduled.expectedJobs.length === context.distributionJobIds.length &&
    scheduled.expectedJobs.every((expected, index) =>
      expected?.id === context.distributionJobIds[index] &&
      expected?.provider === context.channelProviders[index]),
  'scheduled job/provider pairs do not match the requested distribution',
);
const publishIds = publish.jobs.map((job) => job?.id);
assert(
  publishIds.every((jobId) => typeof jobId === 'string' && jobId.length > 0) &&
    new Set(publishIds).size === publishIds.length &&
    publishIds.length === context.distributionJobIds.length &&
    context.distributionJobIds.every((jobId) => publishIds.includes(jobId)),
  'publish job IDs do not match scheduled distribution jobs',
);
const channelIds = publish.jobs.map((job) => job?.channelId);
assert(
  channelIds.every((channelId) => typeof channelId === 'string' && channelId.length > 0) &&
    new Set(channelIds).size === channelIds.length,
  'publish channel IDs are missing or duplicated',
);
const publishedProviders = publish.jobs.map((job) => job?.provider);
assert(
  publishedProviders.every((provider) => typeof provider === 'string' && provider.length > 0) &&
    new Set(publishedProviders).size === context.channelProviders.length &&
    context.channelProviders.every((provider) => publishedProviders.includes(provider)),
  'publish providers do not match requested channel providers',
);
const publishedById = new Map(publish.jobs.map((job) => [job?.id, job]));
assert(
  scheduled.expectedJobs.every((expected) => publishedById.get(expected.id)?.provider === expected.provider),
  'published job/provider pairs do not match scheduled distribution',
);
for (const job of publish.jobs) {
  assert(typeof job.provider === 'string' && job.provider.length > 0, `publish job ${job.id ?? 'unknown'} missing provider`);
  assert(SUCCESS_JOB_STATUSES.has(job.status), `publish job ${job.id ?? 'unknown'} status not successful: ${job.status}`);
}

console.log(`LIVE VIDEO EVIDENCE STRUCTURE PASS (UNSIGNED LOCAL JSON): ${evidencePath}`);
console.log(`Deployment: ${context.deployment?.shortSha ?? context.deployment?.sha}`);
console.log(`Video: ${context.videoId}`);
console.log(`Publish jobs: ${publish.jobs.length}`);
console.log('This validator checks evidence structure and values; it does not cryptographically authenticate the local file.');
