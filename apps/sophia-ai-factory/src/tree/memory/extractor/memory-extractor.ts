import { MemoryRepository, type StoredMemory } from '../memory-repository';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { CreatorMemoryType } from '@/seed/db/types';
import type {
  ChatMessage,
  ExtractOptions,
  ExtractedMemory,
  ExtractionResult,
} from './types';
import { extractPreferences } from './entity-extractor';
import { extractEpisodic, extractSemantic } from './semantic-summarizer';

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

  private collectCandidateMemories(
    userMessages: ChatMessage[],
    minConfidence: number,
  ): { extracted: ExtractedMemory[]; skipped: number } {
    const extracted: ExtractedMemory[] = [];
    let skipped = 0;

    for (const msg of userMessages) {
      const text = msg.content.trim();
      if (text.length < 10) continue;

      const candidates = [
        ...this.extractPreferences([msg]),
        ...this.extractEpisodic([msg]),
        ...this.extractSemantic([msg]),
      ];

      for (const item of candidates) {
        if (item.confidence >= minConfidence) {
          extracted.push(item);
        } else {
          skipped++;
        }
      }
    }

    return { extracted, skipped };
  }

  private capMemoriesByType(
    memories: ExtractedMemory[],
    maxPerType: number,
  ): { capped: ExtractedMemory[]; skipped: number } {
    let skipped = 0;
    const byType = new Map<CreatorMemoryType, ExtractedMemory[]>();

    for (const m of memories) {
      const existing = byType.get(m.memoryType) ?? [];
      if (existing.length < maxPerType) {
        existing.push(m);
      } else {
        skipped++;
      }
      byType.set(m.memoryType, existing);
    }

    const capped: ExtractedMemory[] = [];
    for (const arr of byType.values()) {
      capped.push(...arr);
    }

    return { capped, skipped };
  }

  private async persistExtractedMemories(
    userId: string,
    memories: ExtractedMemory[],
  ): Promise<StoredMemory[]> {
    const stored: StoredMemory[] = [];
    for (const mem of memories) {
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
    return stored;
  }

  /**
   * Run full extraction pipeline on a list of chat messages.
   */
  async extractFromMessages(
    messages: ChatMessage[],
    opts?: ExtractOptions,
  ): Promise<ExtractionResult> {
    const userId = opts?.userId ?? 'anonymous';
    const minConfidence = opts?.minConfidence ?? 0.5;
    const maxPerType = opts?.maxPerType ?? 10;

    const userMessages = messages.filter((m) => m.role === 'user');
    const { extracted, skipped: confSkipped } = this.collectCandidateMemories(userMessages, minConfidence);

    const deduped = this.dedupExtracted(extracted);
    const { capped, skipped: capSkipped } = this.capMemoriesByType(deduped, maxPerType);
    const totalSkipped = confSkipped + capSkipped;

    const stored = await this.persistExtractedMemories(userId, capped);

    logger.info('[MemoryExtractor] Extraction complete', {
      userId,
      messageCount: messages.length,
      extracted: capped.length,
      stored: stored.length,
      skipped: totalSkipped,
    });

    return {
      userId,
      messageCount: messages.length,
      extracted: capped,
      stored,
      skipped: totalSkipped,
    };
  }

  extractPreferences(messages: ChatMessage[]): ExtractedMemory[] {
    return extractPreferences(messages);
  }

  extractEpisodic(messages: ChatMessage[], outcome?: string): ExtractedMemory[] {
    return extractEpisodic(messages, outcome);
  }

  extractSemantic(messages: ChatMessage[]): ExtractedMemory[] {
    return extractSemantic(messages);
  }

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
