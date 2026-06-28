#!/usr/bin/env node
/**
 * Strict live proof:
 * user credentials -> OpenClaw token -> auto-video -> completed video -> multi-platform publish.
 *
 * This intentionally runs real provider calls and can spend provider credits.
 * It requires SOPHIA_LIVE_CONFIRM=run-real-provider-flow.
 */
import { createEvidenceRecorder } from './live-proof/evidence.mjs';
import { createRequester, parseLiveConfig, poll, redact, usage } from './live-proof/runtime.mjs';

const SUCCESS_JOB_STATUSES = new Set(['live', 'published', 'completed', 'succeeded']);
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  usage();
  process.exit(0);
}

const evidence = createEvidenceRecorder(process.env.SOPHIA_LIVE_EVIDENCE_PATH?.trim());

function fail(message) {
  evidence.record('failure', 'failed', { message });
  evidence.write('failed', message);
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

const config = parseLiveConfig(process.env, fail);
const { request, cookieCount } = createRequester(config.baseUrl, fail);
Object.assign(evidence.context, {
  baseUrl: config.baseUrl.origin,
  channelProviders: config.channelProviders,
  topic: config.topic,
});

console.log(`==> Live proof target: ${config.baseUrl.origin}`);
evidence.record('start', 'running', {
  baseUrl: config.baseUrl.origin,
  channelProviders: config.channelProviders,
  publishTimeoutSeconds: config.publishTimeoutMs / 1000,
});

const version = await request('/api/version', { label: 'deployment version' });
evidence.context.deployment = {
  sha: version.sha,
  shortSha: version.shortSha,
  version: version.version,
};
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

const completedHeygen = await poll('HeyGen completion', config.videoTimeoutMs, config.pollIntervalMs, async () => {
  const status = await request(`/api/heygen/status/${encodeURIComponent(heygenJobId)}`, { label: 'poll HeyGen status' });
  if (status.status === 'failed') fail(`HeyGen render failed: ${redact(status.error ?? 'unknown')}`);
  return { done: status.status === 'completed' && Boolean(status.video_url), value: status };
}, fail);
evidence.record('heygen-completion', 'passed', {
  status: completedHeygen.status,
  videoUrlPresent: Boolean(completedHeygen.video_url),
  durationSec: completedHeygen.duration_sec ?? null,
});
console.log('PASS video completed');

const detail = await request(`/api/videos/${encodeURIComponent(videoId)}`, { label: 'fetch completed video row' });
if (detail.video?.status !== 'completed' || !detail.video?.video_url) {
  fail(`video row is not completed with URL: ${redact(JSON.stringify(detail))}`);
}
evidence.record('video-row', 'passed', {
  videoId: detail.video.id,
  status: detail.video.status,
  videoUrlPresent: Boolean(detail.video.video_url),
});
console.log('PASS completed video visible via API');

const distribute = await request(`/api/v1/videos/${encodeURIComponent(videoId)}/distribute`, {
  label: 'schedule multi-platform distribution',
  method: 'POST',
  body: { channelProviders: config.channelProviders, caption: `Sophia live proof ${videoId}` },
});
if (!Array.isArray(distribute.jobIds) || distribute.jobIds.length < config.channelProviders.length) {
  fail(`distribution did not create all jobs: ${redact(JSON.stringify(distribute))}`);
}
evidence.context.distributionJobIds = distribute.jobIds;
evidence.record('distribution-scheduled', 'passed', { jobIds: distribute.jobIds, expectedProviders: config.channelProviders });
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
    provider: job.provider,
    status: job.status,
    attempts: job.attempts,
    updatedAt: job.updatedAt,
  })) ?? [],
});
evidence.write('passed', 'live user video flow completed');
console.log('\nLIVE PROOF PASS: user saved API keys, OpenClaw token ran auto-video, video completed, and multi-platform publish jobs reached live/success.');
