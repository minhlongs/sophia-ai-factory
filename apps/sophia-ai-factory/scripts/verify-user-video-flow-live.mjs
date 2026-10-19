#!/usr/bin/env node
/**
 * Strict live proof:
 * user credentials -> OpenClaw token -> auto-video -> completed video -> multi-platform publish.
 *
 * This intentionally runs real provider calls and can spend provider credits.
 * It requires SOPHIA_LIVE_CONFIRM=run-real-provider-flow.
 */
import { createEvidenceRecorder } from './live-proof/evidence.mjs';
import { createRequester, parseDeploymentVersion, parseLiveConfig, poll, redact, usage } from './live-proof/runtime.mjs';
import { verifyMp4Playback } from './live-proof/media.mjs';
import { createHash, randomUUID } from 'node:crypto';

const SUCCESS_JOB_STATUSES = new Set(['live', 'published', 'completed', 'succeeded']);
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  usage();
  process.exit(0);
}

const evidence = createEvidenceRecorder(process.env.SOPHIA_LIVE_EVIDENCE_PATH?.trim(), {
  schema: 'sophia-live-user-video-flow-proof-v8',
});

function fail(message) {
  evidence.record('failure', 'failed', { message });
  evidence.write('failed', message);
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function parseDatabaseTimestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1_000_000_000_000 ? value * 1000 : value;
  }
  return typeof value === 'string' ? Date.parse(value) : Number.NaN;
}

const config = parseLiveConfig(process.env, fail);
const { request, cookieCount } = createRequester(config.baseUrl, fail);
Object.assign(evidence.context, {
  runId: randomUUID(),
  baseUrl: config.baseUrl.origin,
  channelProviders: config.channelProviders,
  topic: config.topic,
  ...(config.expectedTier ? { expectedTier: config.expectedTier } : {}),
});

console.log(`==> Live proof target: ${config.baseUrl.origin}`);
evidence.record('start', 'running', {
  baseUrl: config.baseUrl.origin,
  channelProviders: config.channelProviders,
  publishTimeoutSeconds: config.publishTimeoutMs / 1000,
});

const version = await request('/api/version', {
  label: 'deployment version',
  headers: { authorization: `Bearer ${config.versionIntrospectToken}` },
});
evidence.context.deployment = parseDeploymentVersion(version, fail);
evidence.record('deployment-version', 'passed', evidence.context.deployment);
console.log(`PASS deployment version shortSha=${version.shortSha ?? 'unknown'}`);

await request('/api/auth/sign-in/email', {
  label: 'sign in',
  method: 'POST',
  body: { email: config.email, password: config.password },
});
if (cookieCount() === 0) fail('sign in succeeded but produced no auth cookies');
evidence.record('sign-in', 'passed', { cookieCount: cookieCount() });
console.log('PASS sign in');

const authenticatedSession = await request('/api/auth/session', { label: 'verify authenticated principal' });
if (authenticatedSession.authenticated !== true || typeof authenticatedSession.user?.id !== 'string') {
  fail('authenticated session did not return a stable user identity');
}
evidence.context.accountRefHash = createHash('sha256').update(authenticatedSession.user.id).digest('hex');
evidence.record('authenticated-principal', 'passed', { accountRefHash: evidence.context.accountRefHash });
console.log('PASS authenticated principal');

await request('/api/health', { label: 'seed csrf token' });

if (!config.preflightOnly) {
  if (!config.expectedTier) fail('paid video proof is missing its expected tier');
  const entitlement = await request('/api/open-core/status', { label: 'verify paid entitlement before video use' });
  if (entitlement.userTier !== config.expectedTier) {
    fail(`paid entitlement mismatch: expected ${config.expectedTier}, received ${entitlement.userTier ?? 'missing'}`);
  }
  evidence.record('paid-entitlement', 'passed', {
    userTier: entitlement.userTier,
    accountRefHash: evidence.context.accountRefHash,
  });
  console.log(`PASS paid entitlement tier=${entitlement.userTier}`);
}

await request('/api/setup/save', {
  label: 'save LLM/BYOK keys',
  method: 'POST',
  body: {
    config: {
      OPENROUTER_API_KEY: config.openrouterKey,
      ANTHROPIC_API_KEY: config.anthropicKey,
      ELEVENLABS_API_KEY: config.optionalKeys.elevenlabs,
      DID_API_KEY: config.optionalKeys.did,
      MUAPI_API_KEY: config.optionalKeys.muapi,
    },
  },
});
evidence.record('save-llm-byok', 'passed', {
  providers: [
    config.openrouterKey ? 'openrouter' : null,
    config.anthropicKey ? 'anthropic' : null,
    config.optionalKeys.elevenlabs ? 'elevenlabs' : null,
    config.optionalKeys.did ? 'd-id' : null,
    config.optionalKeys.muapi ? 'muapi' : null,
  ].filter(Boolean),
});
console.log('PASS save LLM/BYOK keys');

await request('/api/setup-wizard/save-credentials', {
  label: 'save HeyGen credential',
  method: 'POST',
  body: { heygen_api_key: config.heygenKey },
});
evidence.record('save-heygen-credential', 'passed', { provider: 'heygen' });
console.log('PASS save HeyGen credential');

const channelState = await request('/api/v1/integrations/channels', { label: 'preflight connected channels' });
const channels = Array.isArray(channelState.channels) ? channelState.channels : [];
const connectedProviders = new Set(channels
  .filter((channel) => channel?.connected === true && channel?.status === 'active')
  .map((channel) => channel.provider));
const missingProviders = config.channelProviders.filter((provider) => !connectedProviders.has(provider));
if (missingProviders.length > 0) {
  fail(`required publish channels are not active: ${missingProviders.join(', ')}. Connect them before spending provider credits on live video generation.`);
}
evidence.record('channel-preflight', 'passed', {
  requiredProviders: config.channelProviders,
  activeProviders: [...connectedProviders],
});
console.log(`PASS channel preflight providers=${config.channelProviders.join(',')}`);
if (config.preflightOnly) {
  evidence.write('preflight-passed', 'live user video flow preflight completed');
  console.log('\nLIVE PREFLIGHT PASS: deployment, credentials, and publish channels are ready.');
  process.exit(0);
}

const exchange = await request('/api/openclaw/exchange', {
  label: 'mint OpenClaw token',
  method: 'POST',
  body: { ttlSeconds: 3600 },
});
if (!exchange.token) fail('OpenClaw exchange returned no token');
evidence.record('openclaw-exchange', 'passed', { expiresAt: exchange.expiresAt, userIdPresent: Boolean(exchange.userId) });
console.log('PASS OpenClaw exchange');

const mission = await request('/api/missions/auto-video', {
  label: 'OpenClaw auto-video mission',
  method: 'POST',
  headers: { authorization: `Bearer ${exchange.token}` },
  body: {
    topic: config.topic,
    keywords: ['sophia', 'openclaw', 'automation'],
    primaryLanguage: 'en',
    secondaryLanguage: 'vi',
    nicheHint: 'automation',
    maxAffiliateLinks: 1,
  },
});

const videoId = mission.video?.videoId;
const heygenJobId = mission.video?.heygenJobId;
if (!videoId || !heygenJobId) fail(`auto-video did not submit a HeyGen render. Response: ${redact(JSON.stringify(mission))}`);
Object.assign(evidence.context, { missionId: mission.missionId, videoId, heygenJobId });
evidence.record('auto-video', 'passed', { missionId: mission.missionId, videoId, heygenJobId, status: mission.status });
console.log(`PASS auto-video submitted videoId=${videoId}`);

const missionRow = await request(`/api/v1/missions/${encodeURIComponent(mission.missionId)}`, { label: 'verify server mission start row' });
const missionStartedAt = parseDatabaseTimestamp(missionRow.created_at);
if (missionRow.id !== mission.missionId || missionRow.command !== 'auto-video' || !Number.isFinite(missionStartedAt)) {
  fail('auto-video mission row is missing its D1 server start timestamp');
}
evidence.context.serverMissionStartedAt = new Date(missionStartedAt).toISOString();
evidence.record('mission-start-row', 'passed', {
  missionId: missionRow.id,
  command: missionRow.command,
  serverStartedAt: evidence.context.serverMissionStartedAt,
});
console.log('PASS server mission start timestamp');

const completedHeygen = await poll('HeyGen completion', config.videoTimeoutMs, config.pollIntervalMs, async () => {
  const status = await request(`/api/heygen/status/${encodeURIComponent(heygenJobId)}`, { label: 'poll HeyGen status' });
  if (status.status === 'failed') fail(`HeyGen render failed: ${redact(status.error ?? 'unknown')}`);
  return { done: status.status === 'completed' && Boolean(status.video_url), value: status };
}, fail);
evidence.record('heygen-completion', 'passed', {
  heygenJobId,
  status: completedHeygen.status,
  videoUrlPresent: Boolean(completedHeygen.video_url),
  durationSec: completedHeygen.duration_sec ?? null,
});
console.log('PASS video completed');

const detail = await request(`/api/videos/${encodeURIComponent(videoId)}`, { label: 'fetch completed video row' });
if (detail.video?.status !== 'completed' || !detail.video?.video_url) {
  fail(`video row is not completed with URL: ${redact(JSON.stringify(detail))}`);
}
const serverVideoCreatedAt = parseDatabaseTimestamp(detail.video.created_at);
if (!Number.isFinite(serverVideoCreatedAt)) fail('video row is missing a server-created timestamp');
evidence.context.serverVideoCreatedAt = new Date(serverVideoCreatedAt).toISOString();
evidence.record('video-row', 'passed', {
  videoId: detail.video.id,
  status: detail.video.status,
  videoUrlPresent: Boolean(detail.video.video_url),
  serverCreatedAt: evidence.context.serverVideoCreatedAt,
});
console.log('PASS completed video visible via API');

let playableArtifact;
try {
  playableArtifact = await verifyMp4Playback(detail.video.video_url);
} catch (error) {
  fail(`completed video did not pass full-download/decode verification: ${redact(error instanceof Error ? error.message : String(error))}`);
}
evidence.record('video-full-decode', 'passed', playableArtifact);
console.log(`PASS full media download and decode: ${playableArtifact.totalBytes} bytes, ${playableArtifact.videoStreams.length} video stream(s), ${playableArtifact.durationSec}s`);

const distribute = await request(`/api/v1/videos/${encodeURIComponent(videoId)}/distribute`, {
  label: 'schedule multi-platform distribution',
  method: 'POST',
  body: { channelProviders: config.channelProviders, caption: `Sophia live proof ${videoId}` },
});
if (!Array.isArray(distribute.jobIds) || distribute.jobIds.length !== config.channelProviders.length) {
  fail(`distribution did not create all jobs: ${redact(JSON.stringify(distribute))}`);
}
evidence.context.distributionJobIds = distribute.jobIds;
const expectedPublishJobs = distribute.jobIds.map((id, index) => ({ id, provider: config.channelProviders[index] }));
evidence.record('distribution-scheduled', 'passed', {
  jobIds: distribute.jobIds,
  expectedProviders: config.channelProviders,
  expectedJobs: expectedPublishJobs,
});
console.log(`PASS scheduled distribution jobs=${distribute.jobIds.length}`);

const finalPublishState = await poll('publish jobs live', config.publishTimeoutMs, config.pollIntervalMs, async () => {
  const state = await request(`/api/v1/distribute/jobs/${encodeURIComponent(videoId)}/status`, { label: 'poll publish jobs' });
  const jobs = Array.isArray(state.jobs) ? state.jobs : [];
  const wanted = new Set(distribute.jobIds);
  const relevant = jobs.filter((job) => wanted.has(job.id));
  const failed = relevant.find((job) => job.status === 'failed');
  if (failed) fail(`publish job failed: ${redact(JSON.stringify(failed))}`);
  return {
    done: relevant.length === distribute.jobIds.length && relevant.every((job) => SUCCESS_JOB_STATUSES.has(job.status)),
    value: { relevant, pending: relevant.filter((job) => ['scheduled', 'processing', 'queued', 'pending'].includes(job.status)) },
  };
}, fail);

evidence.record('publish-jobs-live', 'passed', {
  jobs: finalPublishState.relevant?.map((job) => ({
    id: job.id,
    channelId: job.channelId,
    provider: job.provider,
    status: job.status,
    attempts: job.attempts,
    updatedAt: job.updatedAt,
  })) ?? [],
});
evidence.write('passed', 'live user video flow completed');
console.log('\nLIVE PROOF PASS: user saved API keys, OpenClaw token ran auto-video, video completed, and multi-platform publish jobs reached live/success.');
