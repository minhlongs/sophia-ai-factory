/**
 * @module tree/memory/memory-extractor
 *
 * MemoryExtractor — extracts structured memories from chat conversations.
 *
 * After a chat session, analyzes the message exchange and creates
 * creator_memory entries of three kinds:
 *
 * - semantic — general knowledge about the user
 * - preference — explicit preferences stated by the user
 * - episodic — specific outcomes from the conversation
 *
 * Extraction is heuristic-based (pattern matching on message content),
 * not LLM-driven — keeps the tree layer free of AI model dependencies.
 *
 * All D1 writes go through MemoryRepository (tree → seed only).
 *
 * @module tree/memory/memory-extractor
 */

import { MemoryRepository, type MemoryContent, type StoredMemory } from './memory-repository';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { CreatorMemoryType } from '@/seed/db/types';

// ── Domain types ──────────────────────────────────────────────────────────────

/** A single chat message. */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

/** Options for extraction. */
export interface ExtractOptions {
  /** Only extract memories above this confidence threshold (0.0–1.0). */
  minConfidence?: number;
  /** Maximum memories to extract per type (default 10). */
  maxPerType?: number;
  /** Override the user ID (defaults to 'anonymous'). */
  userId?: string;
}

/** A single extracted memory before storage. */
export interface ExtractedMemory {
  memoryType: CreatorMemoryType;
  category: string;
  content: MemoryContent;
  confidence: number;
}

/** Summary of an extraction run. */
export interface ExtractionResult {
  userId: string;
  messageCount: number;
  extracted: ExtractedMemory[];
  stored: StoredMemory[];
  skipped: number;
}

// ── Pattern matchers ──────────────────────────────────────────────────────────

/** Preference indicator phrases (user stating a liking or disliking). */
const PREFERENCE_PATTERNS = [
  /\b(i (like|love|prefer|enjoy|hate|dislike|don't like|can't stand|want|need|wish))\b/i,
  /\b(my favorite|my least favorite|always|never|usually|typically)\b/i,
  /\b(use .+ for|stick with|go with|pick .+)\b/i,
  /\b(please .+|make sure .+|remember .+)\b/i,
];

/** Episodic outcome indicators (results, metrics, achievements). */
const EPISODIC_PATTERNS = [
  /\b(got|achieved|reached|hit|generated|produced|created|published)\b.*\b(\d+[kmb]?|\d+\.\d+%?)\b/i,
  /\b(\d+[kmb]?|\d+\.\d+%?)\b.*\b(views|likes|shares|clicks|conversions|sales|revenue)\b/i,
  /\b(result|outcome|performance|metric|score|rating)\b/i,
  /\b(failed|succeeded|worked|didn't work|broke|fixed)\b/i,
];

/** Semantic knowledge indicators (general statements about the user). */
const SEMANTIC_PATTERNS = [
  /\b(i am|i'm|i work|i live|i study|i run|i build|i create|i make)\b/i,
  /\b(my (company|team|business|project|brand|channel|audience|niche|industry))\b/i,
  /\b(we (are|do|make|build|create|focus|specialize))\b/i,
  /\b(our (target|audience|market|niche|focus|goal))\b/i,
];

// ── Category extraction ───────────────────────────────────────────────────────

/** Extract a category label from a preference statement. */
function extractPreferenceCategory(text: string): string {
  const lower = text.toLowerCase();
  if (/\b(color|colour|blue|red|green|yellow|black|white|purple|orange)\b/.test(lower)) return 'color';
  if (/\b(tone|voice|style|casual|formal|funny|serious|professional)\b/.test(lower)) return 'tone';
  if (/\b(thumbnail|image|photo|visual|banner|cover)\b/.test(lower)) return 'visual';
  if (/\b(format|length|short|long|video|post|carousel|story)\b/.test(lower)) return 'format';
  if (/\b(time|schedule|morning|evening|night|friday|monday)\b/.test(lower)) return 'schedule';
  if (/\b(platform|youtube|tiktok|instagram|twitter|linkedin)\b/.test(lower)) return 'platform';
  return 'general';
}

/** Extract a category label from an episodic outcome. */
function extractEpisodicCategory(text: string): string {
  const lower = text.toLowerCase();
  if (/\b(view|watch|play|impression)\b/.test(lower)) return 'views';
  if (/\b(like|heart|engagement)\b/.test(lower)) return 'engagement';
  if (/\b(click|ctr|conversion|sale|revenue|earning)\b/.test(lower)) return 'conversion';
  if (/\b(follower|subscriber|audience|growth)\b/.test(lower)) return 'audience';
  if (/\b(content|post|video|article|reel)\b/.test(lower)) return 'content';
  return 'outcome';
}

/** Extract a category label from semantic knowledge. */
function extractSemanticCategory(text: string): string {
  const lower = text.toLowerCase();
  if (/\b(niche|industry|market|sector)\b/.test(lower)) return 'niche';
  if (/\b(audience|target|demographic|persona)\b/.test(lower)) return 'audience';
  if (/\b(goal|objective|target|mission)\b/.test(lower)) return 'goals';
  if (/\b(team|company|business|brand|startup)\b/.test(lower)) return 'organization';
  return 'profile';
}

// ── Confidence scoring ────────────────────────────────────────────────────────

/**
 * Compute a confidence score for a match.
 * Higher when the pattern matches the full message and contains specific details.
 */
function computeConfidence(text: string, pattern: RegExp): number {
  const match = text.match(pattern);
  if (!match) return 0;
  // Base confidence from match length relative to message.
  const ratio = match[0].length / text.length;
  // Boost if there are specific numbers or details.
  const hasDetail = /\d+[kmb%]?/.test(match[0]);
  return Math.min(1.0, 0.5 + ratio * 0.3 + (hasDetail ? 0.2 : 0));
}

// ── MemoryExtractor ───────────────────────────────────────────────────────────

/**
 * Extracts structured memories from chat message exchanges.
 *
 * Analyzes user messages for preferences, episodic outcomes, and
 * semantic knowledge, then stores them via MemoryRepository.
 *
 * Does NOT call any LLM — all extraction is pattern/heuristic based.
 */
export class MemoryExtractor {
  private readonly repo: MemoryRepository;

  constructor() {
    this.repo = new MemoryRepository();
  }

  // ── Main entry point ───────────────────────────────────────────────────────

  /**
   * Analyze a chat session's messages and extract structured memories.
   *
   * Only processes user messages (assistant messages provide context
   * but are not directly extracted from).
   *
   * @param messages — full chat exchange (user + assistant messages)
   * @param opts — extraction options
   * @returns extraction result with stored memories
   */
  async extractFromMessages(
    messages: ChatMessage[],
    opts?: ExtractOptions,
  ): Promise<ExtractionResult> {
    const userId = opts?.userId ?? 'anonymous';
    const minConfidence = opts?.minConfidence ?? 0.5;
    const maxPerType = opts?.maxPerType ?? 10;

    const userMessages = messages.filter((m) => m.role === 'user');
    const extracted: ExtractedMemory[] = [];
    let skipped = 0;

    // Extract from each user message.
    for (const msg of userMessages) {
      const text = msg.content.trim();
      if (text.length < 10) continue; // Skip trivial messages.

      // Preferences.
      const prefs = this.extractPreferences([msg]);
      for (const p of prefs) {
        if (p.confidence >= minConfidence) extracted.push(p);
        else skipped++;
      }

      // Episodic outcomes.
      const episodics = this.extractEpisodic([msg]);
      for (const e of episodics) {
        if (e.confidence >= minConfidence) extracted.push(e);
        else skipped++;
      }

      // Semantic knowledge.
      const semantics = this.extractSemantic([msg]);
      for (const s of semantics) {
        if (s.confidence >= minConfidence) extracted.push(s);
        else skipped++;
      }
    }

    // Deduplicate within this extraction batch.
    const deduped = this.dedupExtracted(extracted);

    // Cap per type.
    const byType = new Map<CreatorMemoryType, ExtractedMemory[]>();
    for (const m of deduped) {
      const existing = byType.get(m.memoryType) ?? [];
      if (existing.length < maxPerType) existing.push(m);
      else skipped++;
      byType.set(m.memoryType, existing);
    }

    const capped: ExtractedMemory[] = [];
    for (const arr of byType.values()) capped.push(...arr);

    // Store to D1.
    const stored: StoredMemory[] = [];
    for (const mem of capped) {
      try {
        const storedMem = await this.repo.store(userId, mem.memoryType, mem.category, mem.content, {
          relevanceScore: mem.confidence,
        });
        stored.push(storedMem);
      } catch (err) {
        logger.error('[MemoryExtractor] Failed to store memory', {
          userId,
          memoryType: mem.memoryType,
          category: mem.category,
          error: getErrorMessage(err),
        });
      }
    }

    logger.info('[MemoryExtractor] Extraction complete', {
      userId,
      messageCount: messages.length,
      extracted: capped.length,
      stored: stored.length,
      skipped,
    });

    return {
      userId,
      messageCount: messages.length,
      extracted: capped,
      stored,
      skipped,
    };
  }

  // ── Preference extraction ───────────────────────────────────────────────────

  /**
   * Extract explicit preferences from messages.
   *
   * Looks for "I like/love/prefer/hate/dislike" patterns and
   * categorises the preference domain.
   *
   * @param messages — messages to analyze
   * @returns array of extracted preference memories
   */
  extractPreferences(messages: ChatMessage[]): ExtractedMemory[] {
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

  // ── Episodic extraction ─────────────────────────────────────────────────────

  /**
   * Extract episodic memories (specific outcomes) from messages.
   *
   * Looks for result/achievement patterns with metrics or outcomes.
   *
   * @param messages — messages to analyze
   * @param outcome — optional explicit outcome label
   * @returns array of extracted episodic memories
   */
  extractEpisodic(messages: ChatMessage[], outcome?: string): ExtractedMemory[] {
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

  // ── Semantic extraction ────────────────────────────────────────────────────

  /**
   * Extract semantic knowledge (general facts about the user) from messages.
   *
   * Looks for self-descriptive statements about the user's identity,
   * work, audience, or goals.
   *
   * @param messages — messages to analyze
   * @returns array of extracted semantic memories
   */
  extractSemantic(messages: ChatMessage[]): ExtractedMemory[] {
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

  // ── Private helpers ────────────────────────────────────────────────────────

  /** Deduplicate extracted memories by content similarity within the batch. */
  private dedupExtracted(memories: ExtractedMemory[]): ExtractedMemory[] {
    const seen = new Set<string>();
    const result: ExtractedMemory[] = [];

    // Sort by confidence DESC to keep the highest-confidence variant.
    const sorted = [...memories].sort((a, b) => b.confidence - a.confidence);

    for (const mem of sorted) {
      const key = `${mem.memoryType}:${mem.category}:${mem.content.text.slice(0, 50)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(mem);
    }

    return result;
  }
}
