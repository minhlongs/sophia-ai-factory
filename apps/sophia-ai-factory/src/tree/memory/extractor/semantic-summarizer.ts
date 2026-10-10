import type { ChatMessage, ExtractedMemory } from './types';
import { computeConfidence } from './entity-extractor';

/** Episodic outcome indicators (results, metrics, achievements). */
export const EPISODIC_PATTERNS = [
  /\b(got|achieved|reached|hit|generated|produced|created|published)\b.*\b(\d+[kmb]?|\d+\.\d+%?)\b/i,
  /\b(\d+[kmb]?|\d+\.\d+%?)\b.*\b(views|likes|shares|clicks|conversions|sales|revenue)\b/i,
  /\b(result|outcome|performance|metric|score|rating)\b/i,
  /\b(failed|succeeded|worked|didn't work|broke|fixed)\b/i,
];

/** Semantic knowledge indicators (general statements about the user). */
export const SEMANTIC_PATTERNS = [
  /\b(i am|i'm|i work|i live|i study|i run|i build|i create|i make)\b/i,
  /\b(my (company|team|business|project|brand|channel|audience|niche|industry))\b/i,
  /\b(we (are|do|make|build|create|focus|specialize))\b/i,
  /\b(our (target|audience|market|niche|focus|goal))\b/i,
];

/** Extract a category label from an episodic outcome. */
export function extractEpisodicCategory(text: string): string {
  const lower = text.toLowerCase();
  if (/\b(view|watch|play|impression)\b/.test(lower)) return 'views';
  if (/\b(like|heart|engagement)\b/.test(lower)) return 'engagement';
  if (/\b(click|ctr|conversion|sale|revenue|earning)\b/.test(lower)) return 'conversion';
  if (/\b(follower|subscriber|audience|growth)\b/.test(lower)) return 'audience';
  if (/\b(content|post|video|article|reel)\b/.test(lower)) return 'content';
  return 'outcome';
}

/** Extract a category label from semantic knowledge. */
export function extractSemanticCategory(text: string): string {
  const lower = text.toLowerCase();
  if (/\b(niche|industry|market|sector)\b/.test(lower)) return 'niche';
  if (/\b(audience|target|demographic|persona)\b/.test(lower)) return 'audience';
  if (/\b(goal|objective|target|mission)\b/.test(lower)) return 'goals';
  if (/\b(team|company|business|brand|startup)\b/.test(lower)) return 'organization';
  return 'profile';
}

/**
 * Extract episodic memories (specific outcomes) from messages.
 */
export function extractEpisodic(messages: ChatMessage[], outcome?: string): ExtractedMemory[] {
  const results: ExtractedMemory[] = [];
  const userMessages = messages.filter((m) => m.role === 'user');

  for (const msg of userMessages) {
    const text = msg.content.trim();
    for (const pattern of EPISODIC_PATTERNS) {
      const match = text.match(pattern);
      if (!match) continue;

      const confidence = computeConfidence(text, pattern);
      const category = outcome ?? extractEpisodicCategory(text);

      results.push({
        memoryType: 'episodic',
        category,
        content: {
          text: text,
          data: {
            outcome,
            matchedPattern: match[0],
            extractedAt: msg.timestamp ?? Date.now(),
          },
        },
        confidence,
      });
    }
  }

  return results;
}

/**
 * Extract semantic knowledge (general facts about the user) from messages.
 */
export function extractSemantic(messages: ChatMessage[]): ExtractedMemory[] {
  const results: ExtractedMemory[] = [];
  const userMessages = messages.filter((m) => m.role === 'user');

  for (const msg of userMessages) {
    const text = msg.content.trim();
    for (const pattern of SEMANTIC_PATTERNS) {
      const match = text.match(pattern);
      if (!match) continue;

      const confidence = computeConfidence(text, pattern);
      const category = extractSemanticCategory(text);

      results.push({
        memoryType: 'semantic',
        category,
        content: {
          text: text,
          data: {
            statement: match[0],
            extractedAt: msg.timestamp ?? Date.now(),
          },
        },
        confidence,
      });
    }
  }

  return results;
}
