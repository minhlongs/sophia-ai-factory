import { describe, it, expect } from 'vitest';
import {
  growthV11ArbitrageWorker,
  growthV11SchedulerCron,
} from '../growth-v11-arbitrage-worker';

describe('growth-v11-arbitrage-worker (Inngest Worker)', () => {
  it('registers growthV11ArbitrageWorker with correct configuration', () => {
    expect(growthV11ArbitrageWorker).toBeDefined();
    expect(typeof growthV11ArbitrageWorker).toBe('object');
    // Function metadata assertions
    expect(growthV11ArbitrageWorker.name).toContain('Growth Triad v11');
  });

  it('registers growthV11SchedulerCron with cron schedule', () => {
    expect(growthV11SchedulerCron).toBeDefined();
    expect(typeof growthV11SchedulerCron).toBe('object');
    expect(growthV11SchedulerCron.name).toContain('Opportunistic Compute Scheduler Cron');
  });
});
