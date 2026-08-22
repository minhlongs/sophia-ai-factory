import { describe, it, expect } from 'vitest';
import { WINDOW_CONFIGS, ALL_WINDOWS, elapsedWindows, nextPendingWindow, timeRemainingMs, formatTimeRemaining, type MeasurementWindow } from '../measurement-windows';

describe('measurement-windows', () => {
  describe('WINDOW_CONFIGS', () => {
    it('has all three windows', () => {
      expect(WINDOW_CONFIGS['24h']).toBeDefined();
      expect(WINDOW_CONFIGS['7d']).toBeDefined();
      expect(WINDOW_CONFIGS['30d']).toBeDefined();
    });

    it('has correct durations in milliseconds', () => {
      expect(WINDOW_CONFIGS['24h'].durationMs).toBe(24 * 60 * 60 * 1000);
      expect(WINDOW_CONFIGS['7d'].durationMs).toBe(7 * 24 * 60 * 60 * 1000);
      expect(WINDOW_CONFIGS['30d'].durationMs).toBe(30 * 24 * 60 * 60 * 1000);
    });
  });

  describe('ALL_WINDOWS', () => {
    it('contains all window labels', () => {
      expect(ALL_WINDOWS).toEqual(['24h', '7d', '30d']);
    });
  });

  describe('elapsedWindows', () => {
    it('returns empty for no elapsed time', () => {
      const now = new Date();
      const elapsed = elapsedWindows(now, now);
      expect(elapsed).toHaveLength(0);
    });

    it('returns 24h window after 25 hours', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 25 * 60 * 60 * 1000);
      const elapsed = elapsedWindows(past, now);
      expect(elapsed).toContain('24h');
    });

    it('returns 24h and 7d after 8 days', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
      const elapsed = elapsedWindows(past, now);
      expect(elapsed).toContain('24h');
      expect(elapsed).toContain('7d');
    });

    it('returns all windows after 31 days', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);
      const elapsed = elapsedWindows(past, now);
      expect(elapsed).toEqual(['24h', '7d', '30d']);
    });
  });

  describe('nextPendingWindow', () => {
    it('returns 24h as first pending window', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 1 * 60 * 60 * 1000);
      const pending = nextPendingWindow(past, now);
      expect(pending).toBe('24h');
    });

    it('returns 7d after 24h completed', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 25 * 60 * 60 * 1000);
      const pending = nextPendingWindow(past, now);
      expect(pending).toBe('7d');
    });

    it('returns 30d after 24h and 7d completed', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
      const pending = nextPendingWindow(past, now);
      expect(pending).toBe('30d');
    });

    it('returns null when all windows completed', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);
      const pending = nextPendingWindow(past, now);
      expect(pending).toBeNull();
    });
  });

  describe('timeRemainingMs', () => {
    it('returns full duration for fresh publication', () => {
      const now = new Date();
      const remaining = timeRemainingMs(now, now, '24h');
      expect(remaining).toBe(24 * 60 * 60 * 1000);
    });

    it('returns 0 for very old publication', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);
      const remaining = timeRemainingMs(past, now, '24h');
      expect(remaining).toBe(0);
    });

    it('returns positive value for partially elapsed window', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 12 * 60 * 60 * 1000);
      const remaining = timeRemainingMs(past, now, '24h');
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThan(24 * 60 * 60 * 1000);
    });
  });

  describe('formatTimeRemaining', () => {
    it('returns "elapsed" for zero or negative', () => {
      expect(formatTimeRemaining(0)).toBe('elapsed');
      expect(formatTimeRemaining(-1000)).toBe('elapsed');
    });

    it('formats minutes only', () => {
      expect(formatTimeRemaining(30 * 60 * 1000)).toBe('30m');
    });

    it('formats hours and minutes', () => {
      const ms = 2 * 60 * 60 * 1000 + 30 * 60 * 1000;
      expect(formatTimeRemaining(ms)).toBe('2h 30m');
    });

    it('formats total hours without days conversion', () => {
      const ms = 54 * 60 * 60 * 1000;
      expect(formatTimeRemaining(ms)).toBe('54h 0m');
    });
  });
});