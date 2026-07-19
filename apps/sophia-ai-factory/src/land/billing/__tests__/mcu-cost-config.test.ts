/**
 * Unit tests for MCU cost configs
 * @module land/billing/__tests__/mcu-cost-config.test
 */

import { describe, it, expect } from 'vitest';
import { PROPOSAL_MCU_COSTS, getProposalCost } from '../proposal-mcu-cost-config';
import { VIDEO_MCU_COSTS, getVideoCost } from '../video-mcu-cost-config';

describe('proposal-mcu-cost-config', () => {
  describe('PROPOSAL_MCU_COSTS', () => {
    it('defines GENERATE cost', () => {
      expect(PROPOSAL_MCU_COSTS.GENERATE).toBe(5);
    });
  });

  describe('getProposalCost', () => {
    it('returns cost for GENERATE operation', () => {
      expect(getProposalCost('GENERATE')).toBe(5);
    });

    it('returns undefined for unknown operation', () => {
      expect(getProposalCost('UNKNOWN' as never)).toBeUndefined();
    });
  });
});

describe('video-mcu-cost-config', () => {
  describe('VIDEO_MCU_COSTS', () => {
    it('defines all operation costs', () => {
      expect(VIDEO_MCU_COSTS.VIDEO_CREATE).toBe(50);
      expect(VIDEO_MCU_COSTS.SCRIPT_ONLY).toBe(5);
      expect(VIDEO_MCU_COSTS.VOICEOVER_ONLY).toBe(10);
    });
  });

  describe('getVideoCost', () => {
    it('returns cost for VIDEO_CREATE', () => {
      expect(getVideoCost('VIDEO_CREATE')).toBe(50);
    });

    it('returns cost for SCRIPT_ONLY', () => {
      expect(getVideoCost('SCRIPT_ONLY')).toBe(5);
    });

    it('returns cost for VOICEOVER_ONLY', () => {
      expect(getVideoCost('VOICEOVER_ONLY')).toBe(10);
    });

    it('returns undefined for unknown operation', () => {
      expect(getVideoCost('UNKNOWN' as never)).toBeUndefined();
    });
  });
});
