/**
 * Chapter/section generation for YouTube videos.
 * Produces timestamp-based chapter markers from script sections.
 */

export interface ScriptSection {
  readonly title: string;
  readonly duration: number;
}

export interface ChapterEntry {
  readonly time: string;
  readonly title: string;
  readonly seconds: number;
}

export interface ChapterInput {
  readonly sections: readonly ScriptSection[];
  readonly introDurationSeconds?: number;
  readonly outroLabel?: string;
}

const DEFAULT_INTRO_SECONDS = 20;

/**
 * Generate chapter timestamps from a script's sections.
 */
export function generateChapters(input: ChapterInput): ChapterEntry[] {
  const introDuration = input.introDurationSeconds ?? DEFAULT_INTRO_SECONDS;
  const outroLabel = input.outroLabel ?? 'Conclusion & Next Steps';
  const chapters: ChapterEntry[] = [];

  chapters.push({ time: '00:00', title: 'Introduction', seconds: 0 });
  let currentTime = introDuration;

  for (const section of input.sections) {
    chapters.push({
      time: formatTimestamp(currentTime),
      title: section.title,
      seconds: currentTime,
    });
    currentTime += section.duration;
  }

  chapters.push({
    time: formatTimestamp(currentTime),
    title: outroLabel,
    seconds: currentTime,
  });

  return chapters;
}

/**
 * Format seconds into mm:ss timestamp string.
 */
export function formatTimestamp(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Validate that chapters start at 00:00 and are in ascending order.
 */
export function validateChapters(chapters: readonly ChapterEntry[]): {
  valid: boolean;
  errors: readonly string[];
} {
  const errors: string[] = [];
  if (chapters.length === 0) {
    return { valid: false, errors: ['No chapters provided'] };
  }
  if (chapters[0].seconds !== 0) {
    errors.push('First chapter must start at 00:00');
  }
  for (let i = 1; i < chapters.length; i++) {
    if (chapters[i].seconds < chapters[i - 1].seconds) {
      errors.push(`Chapter "${chapters[i].title}" at ${chapters[i].time} is before previous chapter`);
    }
    if (!chapters[i].title.trim()) {
      errors.push(`Chapter at ${chapters[i].time} has an empty title`);
    }
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Calculate total duration in seconds from chapters.
 */
export function totalDuration(chapters: readonly ChapterEntry[]): number {
  if (chapters.length === 0) return 0;
  return chapters[chapters.length - 1].seconds;
}
