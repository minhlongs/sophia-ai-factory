import type { ChatMessage, ExtractedMemory } from './types';

/** Preference indicator phrases (user stating a liking or disliking). */
export const PREFERENCE_PATTERNS = [
  /\b(i (like|love|prefer|enjoy|hate|dislike|don't like|can't stand|want|need|wish))\b/i,
  /\b(my favorite|my least favorite|always|never|usually|typically)\b/i,
  /\b(use .+ for|stick with|go with|pick .+)\b/i,
  /\b(please .+|make sure .+|remember .+)\b/i,
];

/** Extract a category label from a preference statement. */
export function extractPreferenceCategory(text: string): string {
  const lower = text.toLowerCase();
  if (/\b(color|colour|blue|red|green|yellow|black|white|purple|orange)\b/.test(lower)) return 'color';
  if (/\b(tone|voice|style|casual|formal|funny|serious|professional)\b/.test(lower)) return 'tone';
  if (/\b(thumbnail|image|photo|visual|banner|cover)\b/.test(lower)) return 'visual';
  if (/\b(format|length|short|long|video|post|carousel|story)\b/.test(lower)) return 'format';
  if (/\b(time|schedule|morning|evening|night|friday|monday)\b/.test(lower)) return 'schedule';
  if (/\b(platform|youtube|tiktok|instagram|twitter|linkedin)\b/.test(lower)) return 'platform';
  return 'general';
}

/**
 * Compute a confidence score for a pattern match.
 * Higher when the pattern matches the full message and contains specific details.
 */
export function computeConfidence(text: string, pattern: RegExp): number {
  const match = text.match(pattern);
  if (!match) return 0;
  // Base confidence from match length relative to message.
  const ratio = match[0].length / text.length;
  // Boost if there are specific numbers or details.
  const hasDetail = /\d+[kmb%]?/.test(match[0]);
  return Math.min(1.0, 0.5 + ratio * 0.3 + (hasDetail ? 0.2 : 0));
}

/**
 * Extract explicit preferences from messages.
 */
export function extractPreferences(messages: ChatMessage[]): ExtractedMemory[] {
  const results: ExtractedMemory[] = [];
  const userMessages = messages.filter((m) => m.role === 'user');

  for (const msg of userMessages) {
    const text = msg.content.trim();
    for (const pattern of PREFERENCE_PATTERNS) {
      const match = text.match(pattern);
      if (!match) continue;

      const confidence = computeConfidence(text, pattern);
      const category = extractPreferenceCategory(text);
      const sentiment = /\b(like|love|prefer|enjoy|want|need|always|favorite)\b/i.test(match[0])
        ? 'positive'
        : 'negative';

      results.push({
        memoryType: 'preference',
        category,
        content: {
          text: match[0].trim(),
          data: {
            sentiment,
            fullStatement: text,
            extractedAt: msg.timestamp ?? Date.now(),
          },
        },
        confidence,
      });
    }
  }

  return results;
}
