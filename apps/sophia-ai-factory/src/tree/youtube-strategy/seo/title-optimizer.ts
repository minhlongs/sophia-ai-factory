/**
 * Title & Description Optimizer for YouTube SEO
 *
 * @module tree/youtube-strategy/seo/title-optimizer
 */

import {
  POWER_WORDS,
  type ChapterEntry,
  type SEOOptimizationInput,
  type ScriptForSEO,
} from './types';

export function titleCase(str: string): string {
  const smallWords = new Set([
    'a',
    'an',
    'and',
    'as',
    'at',
    'but',
    'by',
    'for',
    'if',
    'in',
    'of',
    'on',
    'or',
    'the',
    'to',
    'via',
    'vs',
  ]);
  return str
    .split(' ')
    .map((word, i) => {
      if (i === 0 || !smallWords.has(word.toLowerCase())) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
      return word.toLowerCase();
    })
    .join(' ');
}

/**
 * Optimize a title for YouTube SEO.
 */
export function optimizeTitle(originalTitle: string, keywords: readonly string[]): string {
  let optimized = originalTitle.trim();

  const hasPowerWord = POWER_WORDS.some((w) =>
    optimized.toLowerCase().includes(w.toLowerCase()),
  );
  if (!hasPowerWord && optimized.length < 60) {
    const word = POWER_WORDS[Math.floor(Math.random() * POWER_WORDS.length)];
    optimized = `${word} ${optimized}`;
  }

  const year = new Date().getFullYear().toString();
  if (!optimized.includes(year) && optimized.length < 70) {
    optimized = `${optimized} (${year})`;
  }

  const primary = keywords[0];
  if (primary && !optimized.toLowerCase().includes(primary.toLowerCase())) {
    optimized = `${optimized} - ${primary}`;
  }

  if (optimized.length > 100) {
    optimized = optimized.slice(0, 97) + '...';
  }

  return titleCase(optimized);
}

/**
 * Generate a structured YouTube description.
 */
export function generateDescription(
  script: ScriptForSEO,
  input: SEOOptimizationInput,
): string {
  const lines: string[] = [];
  const hook = `${script.title} - In this video, you'll discover ${input.angle.toLowerCase()}.`;
  lines.push(hook, '');

  if (script.mainContent?.sections?.length) {
    lines.push("WHAT YOU'LL LEARN:");
    for (const section of script.mainContent.sections.slice(0, 5)) {
      lines.push(`- ${section.title}`);
    }
    lines.push('');
  }

  let timestamp = 20;
  lines.push('TIMESTAMPS:');
  lines.push('00:00 Introduction');
  if (script.mainContent?.sections) {
    for (const section of script.mainContent.sections) {
      const m = Math.floor(timestamp / 60);
      const s = timestamp % 60;
      lines.push(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} ${section.title}`);
      timestamp += section.duration;
    }
  }
  lines.push('');

  const top3 = input.keywords.slice(0, 3).join(', ');
  lines.push('ABOUT THIS VIDEO:');
  lines.push(
    `This comprehensive guide on ${input.topic} covers everything you need to know. ` +
    `Perfect for ${input.targetAudience}. Keywords: ${top3}.`,
  );
  lines.push('');
  lines.push('Subscribe for more content!');
  lines.push('');
  lines.push('DISCLAIMER:');
  lines.push('This video is for educational purposes only.');

  return lines.join('\n');
}

/**
 * Generate chapter timestamps from script sections.
 */
export function generateChapters(script: ScriptForSEO): ChapterEntry[] {
  const chapters: ChapterEntry[] = [];
  chapters.push({ time: '00:00', title: 'Introduction', seconds: 0 });

  let currentTime = 20;
  if (script.mainContent?.sections) {
    for (const section of script.mainContent.sections) {
      const m = Math.floor(currentTime / 60);
      const s = currentTime % 60;
      chapters.push({
        time: `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
        title: section.title,
        seconds: currentTime,
      });
      currentTime += section.duration;
    }
  }

  const cm = Math.floor(currentTime / 60);
  const cs = currentTime % 60;
  chapters.push({
    time: `${String(cm).padStart(2, '0')}:${String(cs).padStart(2, '0')}`,
    title: 'Conclusion & Next Steps',
    seconds: currentTime,
  });

  return chapters;
}
