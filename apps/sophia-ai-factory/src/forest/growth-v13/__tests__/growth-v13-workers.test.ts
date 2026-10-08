import { describe, it, expect } from 'vitest';
import { banditTrafficWorker } from '../bandit-traffic-worker';
import { creativeDeliberationWorker } from '../creative-deliberation-worker';

describe('Growth Triad v13 Inngest Workers', () => {
  it('banditTrafficWorker exposes valid Inngest function definition', () => {
    expect(banditTrafficWorker).toBeDefined();
    expect(banditTrafficWorker.id()).toBe('growth-v13-bandit-traffic-worker');
  });

  it('creativeDeliberationWorker exposes valid Inngest function definition', () => {
    expect(creativeDeliberationWorker).toBeDefined();
    expect(creativeDeliberationWorker.id()).toBe('growth-v13-creative-deliberation-worker');
  });
});
