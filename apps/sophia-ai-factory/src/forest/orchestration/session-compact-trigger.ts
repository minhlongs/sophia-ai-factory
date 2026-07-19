import { promises as fs } from 'fs';
import path from 'path';
import { SessionStateCapper, type SessionEntry } from './session-state-capper';

export class SessionCompactTrigger {
  private lastCompactSize: number = 0;

  /**
   * Checks if the session state exceeds thresholds and performs compaction if necessary.
   * This should be called after tool uses or turns to prevent unbounded file growth.
   */
  async checkAndCompact(sessionId: string, entries: SessionEntry[]): Promise<void> {
    const { action, entries: processedEntries } = SessionStateCapper.enforceLimits(entries);

    if (action === 'compact') {
      const filePath = this.getSessionFilePath(sessionId);

      // Before truncating, we archive a summary/snapshot of the dropped data
      const droppedEntries = entries.slice(0, entries.length - processedEntries.length);
      await this.writeSummary(droppedEntries, filePath);

      // Note: The actual truncation of the .jsonl file is handled by the caller
      // (e.g., orchestrator or hook) using the returned processedEntries.
      this.lastCompactSize = SessionStateCapper.estimateSize(processedEntries);
    }
  }

  private getSessionFilePath(sessionId: string): string {
    // Assuming session logs are stored in a standard .jsonl format based on sessionId
    // The exact path would depend on the orchestrator's storage strategy
    return path.join(process.cwd(), `.session-state-${sessionId}.jsonl`);
  }

  private async writeSummary(entries: SessionEntry[], filePath: string): Promise<void> {
    const archivePath = `${filePath}.archive-${Date.now()}.json`;
    const summary = {
      compactedAt: new Date().toISOString(),
      entryCount: entries.length,
      totalBytes: SessionStateCapper.estimateSize(entries),
      excerpt: entries.length > 0 ? entries[0].content.substring(0, 500) : 'No content',
    };

    try {
      await fs.writeFile(archivePath, JSON.stringify({ summary, droppedEntries: entries }, null, 2));
    } catch (error) {
      // Fail silently or log via utility to avoid breaking the primary flow
    }
  }
}
