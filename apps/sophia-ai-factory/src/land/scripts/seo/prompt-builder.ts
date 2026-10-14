/**
 * SEO Script Prompt and Formatting Utilities
 * Layer: LAND (Business Domain Workflows)
 */

export function buildPrompt(
  topic: string,
  keywords: string[],
  language: 'en' | 'vi',
  min: number,
  max: number,
): string {
  const lang = language === 'vi' ? 'Vietnamese' : 'English';
  const kwLine = keywords.length > 0 ? `Target keywords (use each at least once): ${keywords.join(', ')}` : '';
  return [
    `Write a short ${lang}-language video script about: ${topic}.`,
    `Length: ${min}–${max} words.`,
    kwLine,
    'Format the script in markdown.',
    'Open with an `# H1` title line.',
    'Use `## H2` for at least two body sections.',
    'After the script, append exactly 3 short title alternatives, one per line, prefixed with `TITLE: `.',
    'Do not add any explanation outside of the script and TITLE lines.',
  ]
    .filter((s) => s.length > 0)
    .join('\n');
}

/**
 * Split the LLM output into script + titles. Defensive against missing
 * TITLE: lines and against extra preamble.
 */
export function splitScriptAndTitles(raw: string): { script: string; titles: string[] } {
  const lines = raw.split('\n');
  const titles: string[] = [];
  const scriptLines: string[] = [];
  for (const line of lines) {
    const m = /^TITLE:\s*(.+)$/.exec(line.trim());
    if (m) {
      titles.push(m[1].trim());
    } else {
      scriptLines.push(line);
    }
  }
  return { script: scriptLines.join('\n').trim(), titles };
}

export function extractH1(script: string): string {
  const m = /^#\s+(.+)$/m.exec(script);
  return m ? m[1].trim() : '';
}
