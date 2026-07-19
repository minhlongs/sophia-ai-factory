import { Buffer } from 'buffer';

export interface SessionEntry {
  role: string;
  content: string;
  timestamp: number;
  [key: string]: any; // Allow for tool outputs and metadata
}

export class SessionStateCapper {
  static readonly MAX_SESSION_FILE_MB = 10;
  static readonly MAX_ENTRY_MB = 0.5;
  static readonly MAX_ENTRIES = 5000;
  static readonly COMPACT_RATIO = 0.3; // keep 30% most recent

  /**
   * Determines if the current session entries exceed any of the defined thresholds.
   */
  static shouldCompact(entries: SessionEntry[]): boolean {
    if (entries.length > this.MAX_ENTRIES) return true;
    if (this.estimateSize(entries) > this.MAX_SESSION_FILE_MB * 1024 * 1024) return true;
    return false;
  }

  /**
   * Compacts the session entries by keeping the most recent subset.
   * In a real-world scenario, this would ideally be paired with a summarization LLM call.
   */
  static compact(entries: SessionEntry[]): SessionEntry[] {
    const keepCount = Math.ceil(entries.length * this.COMPACT_RATIO);
    return entries.slice(entries.length - keepCount);
  }

  /**
   * Estimates the total byte size of the session entries when serialized to JSON.
   */
  static estimateSize(entries: SessionEntry[]): number {
    return Buffer.byteLength(JSON.stringify(entries));
  }

  /**
   * Evaluates session state and suggests the necessary action.
   */
  static enforceLimits(entries: SessionEntry[]): { action: 'none' | 'compact' | 'archive'; entries: SessionEntry[] } {
    // Check for individual entry size violations first (hard limit)
    for (const entry of entries) {
      if (Buffer.byteLength(JSON.stringify(entry)) > this.MAX_ENTRY_MB * 1024 * 1024) {
        // If an entry is too large, we must compact or archive immediately
        return { action: 'compact', entries: this.compact(entries) };
      }
    }

    if (this.shouldCompact(entries)) {
      return { action: 'compact', entries: this.compact(entries) };
    }

    return { action: 'none', entries };
  }
}
