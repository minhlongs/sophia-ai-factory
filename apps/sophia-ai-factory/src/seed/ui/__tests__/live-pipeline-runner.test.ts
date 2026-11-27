import { describe, expect, it } from 'vitest';
import { SOPHIA_STUDIO_CAPABILITIES } from '../studio-capability-registry';
import {
  DEFAULT_LIVE_PIPELINE_INPUT,
  runAll34EnginesSnapshot,
} from '../live-pipeline-runner';

describe('live-pipeline-runner (34-Engine A-to-Z Realtime Runner)', () => {
  it('executes all 34 registered engines and returns real telemetry for every engine', () => {
    const results = runAll34EnginesSnapshot(DEFAULT_LIVE_PIPELINE_INPUT);
    expect(results).toHaveLength(SOPHIA_STUDIO_CAPABILITIES.length);
    expect(results.length).toBe(34);

    for (const r of results) {
      expect(['passed', 'warning', 'blocked']).toContain(r.state);
      expect(r.metricOutput.length).toBeGreaterThan(0);
      expect(r.durationMs).toBeGreaterThan(0);
    }
  });

  it('reacts dynamically to empty script and geo-blocked US country', () => {
    const results = runAll34EnginesSnapshot({
      ...DEFAULT_LIVE_PIPELINE_INPUT,
      script: '',
      country: 'US',
      postsToday: 4,
    });

    const hook = results.find((r) => r.engineId === 'hook-beat-evaluator');
    expect(hook?.state).toBe('blocked');

    const geo = results.find((r) => r.engineId === 'geo-failover-router');
    expect(geo?.metricOutput).toContain('TradingView SaaS Pro');

    const cadence = results.find((r) => r.engineId === 'creator-cadence-engine');
    expect(cadence?.state).toBe('warning');
  });
});
