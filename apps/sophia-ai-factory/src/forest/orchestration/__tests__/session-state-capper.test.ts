import { describe, it, expect } from 'vitest';
import { SessionStateCapper, SessionEntry } from '../session-state-capper';

describe('SessionStateCapper', () => {
  const createEntry = (contentSize: number): SessionEntry => ({
    role: 'user',
    content: 'A'.repeat(contentSize),
    timestamp: Date.now(),
  });

  describe('estimateSize', () => {
    it('should estimate byte size of entries', () => {
      const entries = [createEntry(10)];
      const size = SessionStateCapper.estimateSize(entries);
      expect(size).toBeGreaterThan(10); // JSON overhead
      expect(typeof size).toBe('number');
    });
  });

  describe('shouldCompact', () => {
    it('should return false for small session', () => {
      const entries = [createEntry(100)];
      expect(SessionStateCapper.shouldCompact(entries)).toBe(false);
    });

    it('should return true if entries exceed MAX_ENTRIES', () => {
      const entries = Array(SessionStateCapper.MAX_ENTRIES + 1).fill(createEntry(1));
      expect(SessionStateCapper.shouldCompact(entries)).toBe(true);
    });

    it('should return true if total size exceeds MAX_SESSION_FILE_MB', () => {
      // Create entries that total > 10MB
      const entries = [createEntry(11 * 1024 * 1024)];
      expect(SessionStateCapper.shouldCompact(entries)).toBe(true);
    });
  });

  describe('compact', () => {
    it('should keep only the most recent COMPACT_RATIO percent of entries', () => {
      const entries = Array(10).fill(null).map((_, i) => ({
        role: 'user',
        content: `Entry ${i}`,
        timestamp: Date.now() + i,
      }));

      const compacted = SessionStateCapper.compact(entries);
      // 10 * 0.3 = 3
      expect(compacted).toHaveLength(3);
      expect(compacted[0].content).toBe('Entry 7');
      expect(compacted[2].content).toBe('Entry 9');
    });
  });

  describe('enforceLimits', () => {
    it('should return action none if limits are respected', () => {
      const entries = [createEntry(100)];
      const result = SessionStateCapper.enforceLimits(entries);
      expect(result.action).toBe('none');
      expect(result.entries).toEqual(entries);
    });

    it('should compact if an individual entry exceeds MAX_ENTRY_MB', () => {
      const entries = [
        createEntry(100),
        createEntry(0.6 * 1024 * 1024), // > 0.5MB
      ];
      const result = SessionStateCapper.enforceLimits(entries);
      expect(result.action).toBe('compact');
      expect(result.entries.length).toBeLessThan(entries.length);
    });

    it('should compact if total session size exceeds limit', () => {
      const entries = [createEntry(11 * 1024 * 1024)];
      const result = SessionStateCapper.enforceLimits(entries);
      expect(result.action).toBe('compact');
    });

    it('should compact if entry count exceeds limit', () => {
      const entries = Array(SessionStateCapper.MAX_ENTRIES + 1).fill(createEntry(1));
      const result = SessionStateCapper.enforceLimits(entries);
      expect(result.action).toBe('compact');
    });
  });
});
