export function usage() {
  console.log(`Usage:
  SOPHIA_LIVE_CONFIRM=run-real-provider-flow \\
  SOPHIA_LIVE_BASE_URL=https://sophia.agencyos.network \\
  SOPHIA_LIVE_EMAIL=user@example.com \\
  SOPHIA_LIVE_PASSWORD='...' \\
  SOPHIA_LIVE_OPENROUTER_API_KEY='...' \\
  SOPHIA_LIVE_HEYGEN_API_KEY='...' \\
  SOPHIA_LIVE_CHANNEL_PROVIDERS=telegram,youtube \\
  npm run verify:user-video-flow:live

Optional:
  SOPHIA_LIVE_ANTHROPIC_API_KEY
  SOPHIA_LIVE_ELEVENLABS_API_KEY
  SOPHIA_LIVE_DID_API_KEY
  SOPHIA_LIVE_MUAPI_API_KEY
  SOPHIA_LIVE_EVIDENCE_PATH=plans/reports/live-video-proof.json
  SOPHIA_LIVE_PREFLIGHT_ONLY=1
  SOPHIA_LIVE_TOPIC
  SOPHIA_LIVE_VIDEO_TIMEOUT_SECONDS=900
  SOPHIA_LIVE_PUBLISH_TIMEOUT_SECONDS=600
  SOPHIA_LIVE_POLL_INTERVAL_SECONDS=15`);
}

export function redact(value) {
  return String(value)
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/(api[_-]?key|password|token|secret)["':=\s]+[^"',\s}]+/gi, '$1=[REDACTED]');
}

function requireEnv(env, name, fail) {
  const value = env[name]?.trim();
  if (!value) fail(`missing required env ${name}`);
  return value;
}

function optionalEnv(env, name) {
  const value = env[name]?.trim();
  return value || undefined;
}

function secondsEnv(env, name, fallback, fail) {
  const raw = optionalEnv(env, name);
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) fail(`${name} must be a positive number`);
  return n;
}

export function parseLiveConfig(env, fail) {
  const confirm = requireEnv(env, 'SOPHIA_LIVE_CONFIRM', fail);
  if (confirm !== 'run-real-provider-flow') {
    fail('set SOPHIA_LIVE_CONFIRM=run-real-provider-flow to acknowledge real provider calls');
  }

  const openrouterKey = optionalEnv(env, 'SOPHIA_LIVE_OPENROUTER_API_KEY');
  const anthropicKey = optionalEnv(env, 'SOPHIA_LIVE_ANTHROPIC_API_KEY');
  if (!openrouterKey && !anthropicKey) {
    fail('set SOPHIA_LIVE_OPENROUTER_API_KEY or SOPHIA_LIVE_ANTHROPIC_API_KEY');
  }

  const channelProviders = [...new Set(requireEnv(env, 'SOPHIA_LIVE_CHANNEL_PROVIDERS', fail)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean))];
  if (channelProviders.length < 2) {
    fail('SOPHIA_LIVE_CHANNEL_PROVIDERS must include at least 2 distinct providers');
  }

  return {
    baseUrl: new URL(requireEnv(env, 'SOPHIA_LIVE_BASE_URL', fail)),
    email: requireEnv(env, 'SOPHIA_LIVE_EMAIL', fail),
    password: requireEnv(env, 'SOPHIA_LIVE_PASSWORD', fail),
    heygenKey: requireEnv(env, 'SOPHIA_LIVE_HEYGEN_API_KEY', fail),
    openrouterKey,
    anthropicKey,
    optionalKeys: {
      elevenlabs: optionalEnv(env, 'SOPHIA_LIVE_ELEVENLABS_API_KEY'),
      did: optionalEnv(env, 'SOPHIA_LIVE_DID_API_KEY'),
      muapi: optionalEnv(env, 'SOPHIA_LIVE_MUAPI_API_KEY'),
    },
    channelProviders,
    preflightOnly: optionalEnv(env, 'SOPHIA_LIVE_PREFLIGHT_ONLY') === '1',
    topic: optionalEnv(env, 'SOPHIA_LIVE_TOPIC') ?? `Sophia live proof ${new Date().toISOString()}`,
    videoTimeoutMs: secondsEnv(env, 'SOPHIA_LIVE_VIDEO_TIMEOUT_SECONDS', 900, fail) * 1000,
    publishTimeoutMs: secondsEnv(env, 'SOPHIA_LIVE_PUBLISH_TIMEOUT_SECONDS', 600, fail) * 1000,
    pollIntervalMs: secondsEnv(env, 'SOPHIA_LIVE_POLL_INTERVAL_SECONDS', 15, fail) * 1000,
  };
}

function splitSetCookie(header) {
  if (!header) return [];
  return header.split(/,(?=\s*[^;,=\s]+=)/g);
}

export function createRequester(baseUrl, fail) {
  const cookieJar = new Map();
  const cookieHeader = () => [...cookieJar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');

  function storeCookies(response) {
    const values = typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : splitSetCookie(response.headers.get('set-cookie'));
    for (const raw of values) {
      const first = raw.split(';')[0];
      const idx = first.indexOf('=');
      if (idx > 0) cookieJar.set(first.slice(0, idx), first.slice(idx + 1));
    }
  }

  async function request(path, options = {}) {
    const url = new URL(path, baseUrl);
    const response = await fetch(url, {
      method: options.method ?? 'GET',
      headers: {
        accept: 'application/json',
        origin: baseUrl.origin,
        ...(options.body ? { 'content-type': 'application/json' } : {}),
        ...(cookieJar.size ? { cookie: cookieHeader() } : {}),
        ...(options.headers ?? {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      redirect: options.redirect ?? 'manual',
    });
    storeCookies(response);

    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!response.ok) {
      fail(`${options.label ?? path} returned HTTP ${response.status}: ${redact(text.slice(0, 700))}`);
    }
    return json ?? {};
  }

  return { request, cookieCount: () => cookieJar.size };
}

export async function poll(label, timeoutMs, intervalMs, fn, fail) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await fn();
    if (last.done) return last.value;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  fail(`${label} timed out after ${Math.round(timeoutMs / 1000)}s. Last state: ${redact(JSON.stringify(last))}`);
}
