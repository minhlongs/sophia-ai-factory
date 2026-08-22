import { describe, it, expect } from 'vitest';
import { generateChapters, formatTimestamp, validateChapters, totalDuration, type ChapterInput } from '../chapter-generator';

describe('chapter-generator', () => {
  const input: ChapterInput = {
    sections: [
      { title: 'Introduction', duration: 60 },
      { title: 'Setup', duration: 120 },
      { title: 'Basics', duration: 180 },
      { title: 'Advanced Topics', duration: 240 },
    ],
  };

  describe('generateChapters', () => {
    it('generates chapters from sections', () => {
      const chapters = generateChapters(input);
      // intro + 4 sections + outro = 6
      expect(chapters).toHaveLength(6);
      expect(chapters[0].title).toBe('Introduction');
      expect(chapters[0].time).toBe('00:00');
    });

    it('calculates cumulative timestamps', () => {
      const chapters = generateChapters(input);
      expect(chapters[0].time).toBe('00:00');
      // intro is 20s, so first section starts at 00:20
      expect(chapters[1].time).toBe('00:20');
      expect(chapters[2].time).toBe('01:20');
    });

    it('adds conclusion chapter', () => {
      const chapters = generateChapters(input);
      const lastChapter = chapters[chapters.length - 1];
      expect(lastChapter.title.toLowerCase()).toContain('conclusion');
    });

    it('includes seconds for each chapter', () => {
      const chapters = generateChapters(input);
      for (const ch of chapters) {
        expect(typeof ch.seconds).toBe('number');
      }
    });
  });

  describe('formatTimestamp', () => {
    it('formats 0 seconds as 00:00', () => {
      expect(formatTimestamp(0)).toBe('00:00');
    });

    it('formats minutes and seconds', () => {
      expect(formatTimestamp(90)).toBe('01:30');
    });
  });

  describe('validateChapters', () => {
    it('returns valid for correct chapters', () => {
      const chapters = generateChapters(input);
      const result = validateChapters(chapters);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('detects non-sequential timestamps', () => {
      const chapters = [
        { title: 'Intro', time: '00:00', seconds: 60 },
        { title: 'Body', time: '00:00', seconds: 0 },
      ];
      const result = validateChapters(chapters);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('before'))).toBe(true);
    });
  });

  describe('totalDuration', () => {
    it('sums section durations', () => {
      const chapters = generateChapters(input);
      const total = totalDuration(chapters);
      expect(total).toBe(20 + 60 + 120 + 180 + 240);
    });

    it('returns 0 for empty chapters', () => {
      expect(totalDuration([])).toBe(0);
    });
  });
});