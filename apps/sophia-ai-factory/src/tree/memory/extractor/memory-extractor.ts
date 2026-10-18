import { MemoryRepository, type StoredMemory } from '../memory-repository';
import { logger } from '@/seed/utils/logger-utility';
import type {
  ChatMessage,
  ExtractOptions,
  ExtractedMemory,
  ExtractionResult,
} from './types';
import { extractPreferences } from './entity-extractor';
import { extractEpisodic, extractSemantic } from './semantic-summarizer';
import {
  capMemoriesByTypeBatch,
  dedupExtractedMemories,
  persistExtractedMemoriesBatch,
} from './memory-batch-helpers';

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
    return capMemoriesByTypeBatch(memories, maxPerType);
  }

  private async persistExtractedMemories(
    userId: string,
    memories: ExtractedMemory[],
  ): Promise<StoredMemory[]> {
    return persistExtractedMemoriesBatch(this.repo, userId, memories);
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
    return dedupExtractedMemories(memories);
  }
}
