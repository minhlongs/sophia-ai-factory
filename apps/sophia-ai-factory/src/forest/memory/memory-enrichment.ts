/**
 * @module forest/memory/memory-enrichment
 *
 * MemoryEnrichment — post-chat async memory extraction and storage.
 * Import direction: forest → seed, tree (ONE-WAY)
 */

import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import { MemoryExtractor } from '@/tree/memory/memory-extractor';
import {
  createEmptyEnrichmentResult,
  toExtractorChatMessages,
  type EnrichmentResult,
  type MemoryEnrichmentOptions,
} from './memory-enrichment-types';

export { type EnrichmentResult, type MemoryEnrichmentOptions } from './memory-enrichment-types';

export class MemoryEnrichment {
  private readonly extractor: MemoryExtractor;
  private readonly options: Required<Omit<MemoryEnrichmentOptions, 'userId'>> & { userId: string };

  constructor(options: MemoryEnrichmentOptions) {
    this.extractor = new MemoryExtractor();
    this.options = {
      userId: options.userId,
      minConfidence: options.minConfidence ?? 0.5,
      maxPerType: options.maxPerType ?? 10,
      enabled: options.enabled ?? true,
    };
  }

  async enrich(
    messages: { role: string; content: string }[],
  ): Promise<EnrichmentResult> {
    if (!this.options.enabled) {
      logger.debug('[MemoryEnrichment] Disabled via config, skipping');
      return createEmptyEnrichmentResult(this.options.userId);
    }

    if (messages.length === 0) {
      return createEmptyEnrichmentResult(this.options.userId);
    }

    try {
      const extractorMessages = toExtractorChatMessages(messages);

      const result = await this.extractor.extractFromMessages(extractorMessages, {
        userId: this.options.userId,
        minConfidence: this.options.minConfidence,
        maxPerType: this.options.maxPerType,
      });

      logger.info('[MemoryEnrichment] Enrichment complete', {
        userId: this.options.userId,
        messageCount: messages.length,
        extracted: result.extracted.length,
        stored: result.stored.length,
        skipped: result.skipped,
      });

      return {
        userId: this.options.userId,
        success: true,
        extractedCount: result.extracted.length,
        storedCount: result.stored.length,
        skipped: result.skipped,
      };
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      logger.error('[MemoryEnrichment] Enrichment failed', {
        userId: this.options.userId,
        error: errorMsg,
      });
      return createEmptyEnrichmentResult(this.options.userId, errorMsg);
    }
  }

  enrichFireAndForget(messages: { role: string; content: string }[]): void {
    this.enrich(messages).catch((err) => {
      logger.warn('[MemoryEnrichment] Fire-and-forget enrichment failed', {
        userId: this.options.userId,
        error: getErrorMessage(err),
      });
    });
  }
}

let enrichmentInstance: MemoryEnrichment | null = null;

export function getMemoryEnrichment(options?: MemoryEnrichmentOptions): MemoryEnrichment {
  if (!enrichmentInstance) {
    enrichmentInstance = new MemoryEnrichment(options ?? { userId: 'anonymous' });
  }
  return enrichmentInstance;
}

export function resetMemoryEnrichment(): void {
  enrichmentInstance = null;
}
