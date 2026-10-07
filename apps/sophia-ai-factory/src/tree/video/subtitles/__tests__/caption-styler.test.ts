import { describe, expect, it } from 'vitest';
import { formatSubtitlesToVTT, generateStyledSubtitles } from '../caption-styler';

describe('Subtitle & Caption Styler Engine', () => {
  it('chunks script into short dynamic bursts with word-level timing', () => {
    const spec = generateStyledSubtitles({
      scriptText: 'Stop building software manually! This AI tool prints money.',
      totalDurationSeconds: 6.0,
      wordsPerChunk: 3,
      theme: 'hormozi_bold_yellow',
    });

    expect(spec.totalWords).toBe(9);
    expect(spec.chunks.length).toBe(3);
    expect(spec.chunks[0].words.length).toBe(3);
    expect(spec.chunks[0].startTimeSeconds).toBe(0);
    expect(spec.chunks[spec.chunks.length - 1].endTimeSeconds).toBe(6.0);
  });

  it('detects high-converting trigger words and attaches emojis and highlight colors', () => {
    const spec = generateStyledSubtitles({
      scriptText: 'Unlock the secret AI money hack for Solana crypto',
      totalDurationSeconds: 8.0,
      wordsPerChunk: 2,
    });

    expect(spec.highlightedWordsCount).toBeGreaterThanOrEqual(4);
    const highlighted = spec.chunks
      .flatMap((c) => c.words)
      .filter((w) => w.isHighConvertingKeyword);

    const words = highlighted.map((w) => w.word);
    expect(words).toContain('SECRET');
    expect(words).toContain('AI');
    expect(words).toContain('MONEY');
    expect(words).toContain('SOLANA');

    const aiWord = highlighted.find((w) => w.word === 'AI');
    expect(aiWord?.emojiBadge).toBe('🤖');
  });

  it('formats subtitle track spec into standard WebVTT output', () => {
    const spec = generateStyledSubtitles({
      scriptText: 'Claim your free crypto airdrop now',
      totalDurationSeconds: 4.0,
      wordsPerChunk: 3,
    });

    const vtt = formatSubtitlesToVTT(spec);
    expect(vtt).toContain('WEBVTT');
    expect(vtt).toContain('-->');
    expect(vtt).toContain('AIRDROP');
  });
});
