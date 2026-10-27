import { describe, it, expect } from 'vitest';
import {
  GUIDE_BACKEND_STATS,
  GUIDE_PIPELINE_STAGES,
  GUIDE_BACKEND_PILLARS,
} from '../index';

describe('seed/guide catalog & backend pillars', () => {
  it('exposes verified backend stats', () => {
    expect(GUIDE_BACKEND_STATS.apiRoutesCount).toBeGreaterThanOrEqual(350);
    expect(GUIDE_BACKEND_STATS.inngestJobsCount).toBe(132);
    expect(GUIDE_BACKEND_STATS.affiliateNetworksCount).toBe(10);
    expect(GUIDE_BACKEND_STATS.publishingChannelsCount).toBe(11);
    expect(GUIDE_BACKEND_STATS.supportedNichesCount).toBe(51);
  });

  it('defines all 5 visual pipeline stages with bilingual Input/Engine/Output', () => {
    expect(GUIDE_PIPELINE_STAGES).toHaveLength(5);
    GUIDE_PIPELINE_STAGES.forEach((stage, index) => {
      expect(stage.step).toBe(index + 1);
      expect(stage.name.vi.length).toBeGreaterThan(5);
      expect(stage.name.en.length).toBeGreaterThan(5);
      expect(stage.input.vi.length).toBeGreaterThan(10);
      expect(stage.engine.vi.length).toBeGreaterThan(10);
      expect(stage.output.vi.length).toBeGreaterThan(10);
      expect(stage.sampleCommand.length).toBeGreaterThan(5);
      expect(stage.sampleResult.length).toBeGreaterThan(5);
    });
  });

  it('defines all 8 backend pillars with routes, Inngest jobs, and safety guarantees', () => {
    expect(GUIDE_BACKEND_PILLARS).toHaveLength(8);
    GUIDE_BACKEND_PILLARS.forEach((pillar, index) => {
      expect(pillar.number).toBe(index + 1);
      expect(pillar.title.vi.length).toBeGreaterThan(5);
      expect(pillar.title.en.length).toBeGreaterThan(5);
      expect(pillar.capabilities.length).toBeGreaterThanOrEqual(3);
      expect(pillar.representativeRoutes.length).toBeGreaterThanOrEqual(3);
      expect(pillar.representativeJobs.length).toBeGreaterThanOrEqual(2);
      expect(pillar.safetyPillar.vi.length).toBeGreaterThan(10);
      expect(pillar.safetyPillar.en.length).toBeGreaterThan(10);
    });
  });
});
