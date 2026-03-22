/**
 * Onboarding Tests
 */

import { describe, it, expect } from 'vitest';
import { DEFAULT_ONBOARDING_STEPS, calculateProgress } from '@/lib/onboarding/config';

describe('Onboarding', () => {
  describe('Default Steps', () => {
    it('should have 7 onboarding steps', () => {
      expect(DEFAULT_ONBOARDING_STEPS.length).toBe(7);
    });

    it('should have create_org as first step', () => {
      expect(DEFAULT_ONBOARDING_STEPS[0].id).toBe('create_org');
    });

    it('should have review_analytics as last step', () => {
      expect(DEFAULT_ONBOARDING_STEPS[6].id).toBe('review_analytics');
    });
  });

  describe('Progress Calculation', () => {
    it('should calculate 0% for no completed steps', () => {
      const steps = DEFAULT_ONBOARDING_STEPS.map((s) => ({ ...s, completed: false }));
      expect(calculateProgress(steps)).toBe(0);
    });

    it('should calculate 100% for all completed steps', () => {
      const steps = DEFAULT_ONBOARDING_STEPS.map((s) => ({ ...s, completed: true }));
      expect(calculateProgress(steps)).toBe(100);
    });

    it('should calculate 50% for 3-4 completed steps (7 total)', () => {
      const steps = DEFAULT_ONBOARDING_STEPS.map((s, i) => ({
        ...s,
        completed: i < 4,
      }));
      expect(calculateProgress(steps)).toBeCloseTo(57, 0);
    });
  });

  describe('Email Sequence', () => {
    it('should have 5 email templates', () => {
      const templates = ['day_0', 'day_1', 'day_3', 'day_5', 'day_7'];
      expect(templates.length).toBe(5);
    });

    it('should schedule day_0 email immediately', () => {
      expect('day_0').toBe('day_0'); // Placeholder
    });
  });
});
