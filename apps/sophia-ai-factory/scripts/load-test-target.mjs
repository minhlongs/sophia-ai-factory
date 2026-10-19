const PRODUCTION_HOSTS = new Set(['sophia.agencyos.network', 'www.sophia.agencyos.network']);
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export function validateLoadTestTarget(value, remoteConfirmation) {
  const match = /^(https?):\/\/([^/?#]+)\/?$/i.exec(value || '');
  if (!match || match[2].includes('@')) {
    throw new Error('Load test target must be an absolute URL.');
  }

  const protocol = match[1].toLowerCase();
  const authority = match[2];
  const authorityParts = /^(\[[0-9a-f:.]+\]|[^:]+)(?::(\d+))?$/i.exec(authority);
  if (!authorityParts) throw new Error('Load test target has an invalid host or port.');
  const rawHostname = authorityParts[1];
  const hostname = rawHostname.replace(/^\[|\]$/g, '').toLowerCase().replace(/\.$/, '');
  const port = authorityParts[2];
  if (port && (Number(port) < 1 || Number(port) > 65535)) {
    throw new Error('Load test target has an invalid port.');
  }
  const local = LOCAL_HOSTS.has(hostname);
  if (PRODUCTION_HOSTS.has(hostname)) {
    throw new Error('Load tests against Sophia production are disabled. Use localhost or an approved staging origin.');
  }
  if (local && protocol === 'http') return `${protocol}://${authority}`;
  if (protocol !== 'https') {
    throw new Error('Remote load test targets must use HTTPS.');
  }
  if (remoteConfirmation !== 'run-staging-load') {
    throw new Error('Remote load tests require SOPHIA_STAGING_LOAD_CONFIRM=run-staging-load.');
  }
  return `https://${authority.toLowerCase()}`;
}

export function boundedLoadInteger(value, fallback, minimum, maximum, label) {
  const number = value === undefined || value === '' ? fallback : Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new Error(`${label} must be an integer from ${minimum} to ${maximum}.`);
  }
  return number;
}

export function boundedLoadDuration(value, fallback, maximumSeconds, label) {
  const duration = value === undefined || value === '' ? fallback : value;
  const match = /^(\d+)(s|m)$/.exec(duration);
  if (!match) throw new Error(`${label} must use seconds or minutes (for example 30s or 10m).`);
  const seconds = Number(match[1]) * (match[2] === 'm' ? 60 : 1);
  if (seconds < 1 || seconds > maximumSeconds) {
    throw new Error(`${label} must not exceed ${maximumSeconds} seconds.`);
  }
  return duration;
}

function parseK6DurationSeconds(value, label) {
  const duration = String(value || '');
  const matcher = /(\d+(?:\.\d+)?)(ms|h|m|s)/g;
  const factors = { ms: 0.001, s: 1, m: 60, h: 3600 };
  let seconds = 0;
  let consumed = 0;
  for (const match of duration.matchAll(matcher)) {
    if (match.index !== consumed) throw new Error(`${label} has an unsupported k6 duration.`);
    seconds += Number(match[1]) * factors[match[2]];
    consumed += match[0].length;
  }
  if (consumed !== duration.length || consumed === 0) {
    throw new Error(`${label} has an unsupported k6 duration.`);
  }
  return seconds;
}

/** Validate k6's consolidated options, including CLI overrides, before VUs start. */
export function validateK6EffectiveOptions(scenarios, maximumVus, maximumDurationSeconds) {
  if (!scenarios || typeof scenarios !== 'object' || Object.keys(scenarios).length === 0) {
    throw new Error('k6 effective options contain no scenarios.');
  }

  for (const [name, scenario] of Object.entries(scenarios)) {
    let peakVus;
    let activeSeconds;
    let rampDownSeconds = 0;

    if (scenario.executor === 'constant-vus') {
      peakVus = scenario.vus;
      activeSeconds = parseK6DurationSeconds(scenario.duration, `${name} duration`);
    } else if (scenario.executor === 'ramping-vus') {
      if (!Array.isArray(scenario.stages) || scenario.stages.length === 0) {
        throw new Error(`${name} has no supported k6 stages.`);
      }
      peakVus = Math.max(scenario.startVUs || 0, ...scenario.stages.map((stage) => stage.target));
      activeSeconds = scenario.stages.reduce(
        (total, stage) => total + parseK6DurationSeconds(stage.duration, `${name} stage duration`),
        0,
      );
      rampDownSeconds = scenario.gracefulRampDown == null
        ? 30
        : parseK6DurationSeconds(scenario.gracefulRampDown, `${name} graceful ramp-down`);
    } else {
      throw new Error(`${name} uses unsupported executor ${scenario.executor}; refusing unbounded profile options.`);
    }

    const vus = Number(peakVus);
    if (!Number.isInteger(vus) || vus < 1 || vus > maximumVus) {
      throw new Error(`${name} effective peak VUs must be from 1 to ${maximumVus}.`);
    }
    const gracefulStopSeconds = scenario.gracefulStop == null
      ? 30
      : parseK6DurationSeconds(scenario.gracefulStop, `${name} graceful stop`);
    if (activeSeconds + rampDownSeconds + gracefulStopSeconds > maximumDurationSeconds) {
      throw new Error(`${name} effective runtime must not exceed ${maximumDurationSeconds} seconds including graceful shutdown.`);
    }
  }
}
