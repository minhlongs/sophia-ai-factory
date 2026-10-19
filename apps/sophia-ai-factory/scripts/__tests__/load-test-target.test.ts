import { describe, expect, it } from 'vitest';
import {
  boundedLoadDuration,
  boundedLoadInteger,
  validateK6EffectiveOptions,
  validateLoadTestTarget,
} from '../load-test-target.mjs';

describe('validateLoadTestTarget', () => {
  it.each(['https://sophia.agencyos.network', 'https://www.sophia.agencyos.network'])(
    'always blocks production origin %s', (target) => {
      expect(() => validateLoadTestTarget(target, 'run-staging-load'))
        .toThrow('Load tests against Sophia production are disabled');
    },
  );

  it('allows local HTTP without a remote confirmation', () => {
    expect(validateLoadTestTarget('http://localhost:3000', undefined)).toBe('http://localhost:3000');
  });

  it('requires an explicit staging acknowledgement for remote HTTPS', () => {
    expect(() => validateLoadTestTarget('https://staging.example.com', undefined))
      .toThrow('Remote load tests require SOPHIA_STAGING_LOAD_CONFIRM=run-staging-load');
    expect(validateLoadTestTarget('https://staging.example.com', 'run-staging-load'))
      .toBe('https://staging.example.com');
  });

  it.each([
    'http://staging.example.com',
    'https://user:secret@staging.example.com',
    'https://staging.example.com/path',
    'https://staging.example.com?target=prod',
  ])('rejects unsafe target URL %s', (target) => {
    expect(() => validateLoadTestTarget(target, 'run-staging-load')).toThrow();
  });
});

describe('bounded k6 profile inputs', () => {
  it('applies defaults and rejects VU values outside configured bounds', () => {
    expect(boundedLoadInteger(undefined, 10, 1, 50, 'K6_VUS')).toBe(10);
    expect(boundedLoadInteger('50', 10, 1, 50, 'K6_VUS')).toBe(50);
    expect(() => boundedLoadInteger('51', 10, 1, 50, 'K6_VUS')).toThrow('K6_VUS');
    expect(() => boundedLoadInteger('1.5', 10, 1, 50, 'K6_VUS')).toThrow('K6_VUS');
  });

  it('allows only bounded seconds or minutes for durations', () => {
    expect(boundedLoadDuration(undefined, '30s', 1800, 'K6_DURATION')).toBe('30s');
    expect(boundedLoadDuration('30m', '30s', 1800, 'K6_DURATION')).toBe('30m');
    expect(() => boundedLoadDuration('31m', '30s', 1800, 'K6_DURATION')).toThrow('K6_DURATION');
    expect(() => boundedLoadDuration('2h', '30s', 1800, 'K6_DURATION')).toThrow('K6_DURATION');
  });
});

describe('validateK6EffectiveOptions', () => {
  it('accepts an in-bound constant VU scenario including graceful shutdown', () => {
    expect(() => validateK6EffectiveOptions({ steady: {
      executor: 'constant-vus', vus: 50, duration: '29m', gracefulStop: null,
    } }, 50, 1800)).not.toThrow();
  });

  it('rejects CLI-overridden VU and duration values before VUs start', () => {
    expect(() => validateK6EffectiveOptions({ default: {
      executor: 'constant-vus', vus: 51, duration: '1s',
    } }, 50, 1800)).toThrow('effective peak VUs');
    expect(() => validateK6EffectiveOptions({ default: {
      executor: 'constant-vus', vus: 1, duration: '30m',
    } }, 50, 1800)).toThrow('including graceful shutdown');
    expect(() => validateK6EffectiveOptions({ default: {
      executor: 'constant-vus', vus: 1, duration: '31m0s',
    } }, 50, 1800)).toThrow('including graceful shutdown');
  });

  it('bounds ramping VUs and the complete stage plus shutdown window', () => {
    expect(() => validateK6EffectiveOptions({ spike: {
      executor: 'ramping-vus', startVUs: 0,
      stages: [{ target: 51, duration: '30s' }],
    } }, 50, 1800)).toThrow('effective peak VUs');
    expect(() => validateK6EffectiveOptions({ spike: {
      executor: 'ramping-vus', startVUs: 0,
      stages: [{ target: 5, duration: '30m' }],
    } }, 50, 1800)).toThrow('including graceful shutdown');
  });

  it('refuses unsupported executors instead of guessing their resource use', () => {
    expect(() => validateK6EffectiveOptions({ custom: {
      executor: 'shared-iterations', vus: 1, iterations: 1,
    } }, 50, 1800)).toThrow('unsupported executor');
  });
});
