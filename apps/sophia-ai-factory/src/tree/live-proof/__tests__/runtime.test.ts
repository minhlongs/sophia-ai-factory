import { describe, expect, it } from 'vitest';
import { parseDeploymentVersion, parseLiveConfig, redact } from '../../../../scripts/live-proof/runtime.mjs';

const FULL_SHA = 'abcdef1234567890abcdef1234567890abcdef12';

function baseEnv(overrides: Record<string, string> = {}) {
  return {
    SOPHIA_LIVE_CONFIRM: 'run-real-provider-flow',
    SOPHIA_LIVE_BASE_URL: 'https://staging.example.test',
    SOPHIA_LIVE_EMAIL: 'live-test@example.test',
    SOPHIA_LIVE_PASSWORD: 'test-password',
    SOPHIA_LIVE_OPENROUTER_API_KEY: 'sk-or-test-key',
    SOPHIA_LIVE_HEYGEN_API_KEY: 'heygen-test-key',
    SOPHIA_LIVE_CHANNEL_PROVIDERS: 'telegram,youtube',
    SOPHIA_LIVE_TEST_TENANT: '1',
    SOPHIA_LIVE_EXPECTED_TIER: 'BASIC',
    SOPHIA_VERSION_INTROSPECT_TOKEN: 'test-introspection-token',
    ...overrides,
  };
}

function runConfig(env: Record<string, string>) {
  return parseLiveConfig(env, (message: string) => { throw new Error(message); });
}

describe('live proof runtime', () => {
  it('requires a confirmed dedicated non-customer tenant', () => {
    expect(() => runConfig(baseEnv({ SOPHIA_LIVE_TEST_TENANT: '' })))
      .toThrow('dedicated non-customer test tenant');
  });

  it('guards production even when the hostname has a trailing dot', () => {
    expect(() => runConfig(baseEnv({ SOPHIA_LIVE_BASE_URL: 'https://sophia.agencyos.network.' })))
      .toThrow('production target requires SOPHIA_LIVE_ALLOW_PRODUCTION=1');
  });

  it('requires the full SHA introspection credential', () => {
    expect(() => runConfig(baseEnv({ SOPHIA_VERSION_INTROSPECT_TOKEN: '' })))
      .toThrow('SOPHIA_VERSION_INTROSPECT_TOKEN');
  });

  it('requires an explicit activated tier for paid video runs', () => {
    expect(() => runConfig(baseEnv({ SOPHIA_LIVE_EXPECTED_TIER: '' })))
      .toThrow('SOPHIA_LIVE_EXPECTED_TIER');
  });

  it('allows preflight without a payment tier', () => {
    expect(runConfig(baseEnv({ SOPHIA_LIVE_EXPECTED_TIER: '', SOPHIA_LIVE_PREFLIGHT_ONLY: '1' })).expectedTier)
      .toBeUndefined();
  });

  it('accepts only a matching full deployment SHA and short prefix', () => {
    const fail = (message: string): never => { throw new Error(message); };
    expect(parseDeploymentVersion({ commitSha: FULL_SHA, shortSha: FULL_SHA.slice(0, 8), opennextVersion: '1.19.9' }, fail))
      .toEqual({ sha: FULL_SHA, shortSha: FULL_SHA.slice(0, 8), version: '1.19.9' });
    expect(() => parseDeploymentVersion({ commitSha: FULL_SHA, shortSha: 'badbad00' }, fail))
      .toThrow('shortSha does not match');
  });

  it('redacts signed media URLs from free-text failures', () => {
    expect(redact('provider returned https://cdn.example/video.mp4?token=signed-secret'))
      .toBe('provider returned [URL_REDACTED]');
  });
});
