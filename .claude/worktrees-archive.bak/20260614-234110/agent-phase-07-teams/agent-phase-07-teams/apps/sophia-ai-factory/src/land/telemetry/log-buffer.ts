/**
 * LogBuffer — RED-TEAM #9
 * Per-request log accumulator with hard cap of 3 outbound entries.
 * Excess entries dropped; drop count exposed via droppedCount for metrics.
 * Flush via ctx.waitUntil() AFTER response sent — zero subrequest cost in hot path.
 */

import type { SafeLogPayload } from './safe-log';

/** Maximum log entries shipped per request (CF subrequest budget guard) */
const MAX_OUTBOUND = 3;

export class LogBuffer {
  private entries: SafeLogPayload[] = [];
  /** Count of entries dropped due to MAX_OUTBOUND cap */
  droppedCount = 0;

  /**
   * Add a log entry. Entries beyond MAX_OUTBOUND are silently dropped
   * and counted in droppedCount.
   */
  push(entry: SafeLogPayload): void {
    if (this.entries.length < MAX_OUTBOUND) {
      this.entries.push(entry);
    } else {
      this.droppedCount++;
    }
  }

  /**
   * Return buffered entries and clear the buffer.
   * Call inside ctx.waitUntil() after response is sent.
   */
  flush(): SafeLogPayload[] {
    const out = this.entries.slice();
    this.entries = [];
    return out;
  }

  /** Current entry count (before flush) */
  get size(): number {
    return this.entries.length;
  }
}
