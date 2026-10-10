import type { CreatorMemoryType } from '@/seed/db/types';
import type { MemoryContent, StoredMemory } from '../memory-repository';

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
