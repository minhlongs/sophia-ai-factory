/**
 * Video Job FSM Tests
 *
 * Verifies: valid transitions accepted, invalid rejected, idempotent re-fire safe.
 */

import { describe, it, expect } from 'vitest';
import {
  isValidTransition,
  isAlreadyIn,
  assertValidTransition,
  STATUS_PROGRESS,
  TERMINAL_STATES,
} from '../generation/video-job-fsm';
import type { VideoJobStatus } from '../generation/video-job-fsm';

describe('VideoJobFSM', () => {
  describe('isValidTransition', () => {
    it('accepts valid forward transitions', () => {
      expect(isValidTransition('queued', 'scripting')).toBe(true);
      expect(isValidTransition('scripting', 'tts_pending')).toBe(true);
      expect(isValidTransition('tts_pending', 'visual_pending')).toBe(true);
      expect(isValidTransition('visual_pending', 'composing')).toBe(true);
      expect(isValidTransition('composing', 'uploaded')).toBe(true);
      expect(isValidTransition('uploaded', 'published')).toBe(true);
    });

    it('accepts any non-terminal → failed', () => {
      const nonTerminal: VideoJobStatus[] = [
        'queued', 'scripting', 'tts_pending', 'visual_pending', 'composing', 'uploaded',
      ];
      for (const s of nonTerminal) {
        expect(isValidTransition(s, 'failed')).toBe(true);
      }
    });

    it('rejects backward transitions', () => {
      expect(isValidTransition('scripting', 'queued')).toBe(false);
      expect(isValidTransition('published', 'uploaded')).toBe(false);
      expect(isValidTransition('tts_pending', 'scripting')).toBe(false);
    });

    it('rejects transitions from terminal states', () => {
      expect(isValidTransition('published', 'uploaded')).toBe(false);
      expect(isValidTransition('failed', 'queued')).toBe(false);
      expect(isValidTransition('published', 'failed')).toBe(false);
    });

    it('rejects skipping states', () => {
      expect(isValidTransition('queued', 'tts_pending')).toBe(false);
      expect(isValidTransition('scripting', 'composing')).toBe(false);
    });
  });

  describe('isAlreadyIn', () => {
    it('returns true when current === target (idempotent)', () => {
      expect(isAlreadyIn('scripting', 'scripting')).toBe(true);
      expect(isAlreadyIn('queued', 'queued')).toBe(true);
    });

    it('returns false when current !== target', () => {
      expect(isAlreadyIn('queued', 'scripting')).toBe(false);
    });
  });

  describe('assertValidTransition', () => {
    it('does not throw for valid transitions', () => {
      expect(() => assertValidTransition('queued', 'scripting')).not.toThrow();
      expect(() => assertValidTransition('scripting', 'tts_pending')).not.toThrow();
    });

    it('does not throw for idempotent re-fire (same state)', () => {
      expect(() => assertValidTransition('scripting', 'scripting')).not.toThrow();
      expect(() => assertValidTransition('published', 'published')).not.toThrow();
    });

    it('throws for invalid transitions', () => {
      expect(() => assertValidTransition('published', 'queued')).toThrow('[VideoJobFSM]');
      expect(() => assertValidTransition('queued', 'composing')).toThrow('[VideoJobFSM]');
    });

    it('throws when transitioning from terminal state to different state', () => {
      expect(() => assertValidTransition('published', 'failed')).toThrow('[VideoJobFSM]');
      expect(() => assertValidTransition('failed', 'scripting')).toThrow('[VideoJobFSM]');
    });
  });

  describe('STATUS_PROGRESS', () => {
    it('has 0% for queued', () => {
      expect(STATUS_PROGRESS.queued).toBe(0);
    });

    it('has 100% for published', () => {
      expect(STATUS_PROGRESS.published).toBe(100);
    });

    it('progresses monotonically through pipeline', () => {
      const pipeline: VideoJobStatus[] = [
        'queued', 'scripting', 'tts_pending', 'visual_pending', 'composing', 'uploaded', 'published',
      ];
      for (let i = 1; i < pipeline.length; i++) {
        expect(STATUS_PROGRESS[pipeline[i]]).toBeGreaterThanOrEqual(STATUS_PROGRESS[pipeline[i - 1]]);
      }
    });
  });

  describe('TERMINAL_STATES', () => {
    it('includes published and failed', () => {
      expect(TERMINAL_STATES.has('published')).toBe(true);
      expect(TERMINAL_STATES.has('failed')).toBe(true);
    });

    it('does not include intermediate states', () => {
      expect(TERMINAL_STATES.has('queued')).toBe(false);
      expect(TERMINAL_STATES.has('scripting')).toBe(false);
    });
  });
});
