import { SessionCompactTrigger } from './session-compact-trigger';
import { type SessionEntry } from './session-state-capper';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Bridge between Claude Code hooks and the session capper.
 * This class orchestrates the triggers and ensures the session state
 * remains within defined memory/file size limits.
 */
export class SessionHookIntegration {
  private trigger: SessionCompactTrigger;
  private sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.trigger = new SessionCompactTrigger();
  }

  /**
   * Called by hooks after a tool has been used.
   * Checks if the current state needs compaction based on entry count and estimated size.
   */
  async onToolUse(entryCount: number, estimatedBytes: number): Promise<void> {
    try {
      const entries = await this.loadSessionEntries();
      await this.trigger.checkAndCompact(this.sessionId, entries);
    } catch (error) {
      // Fail silently to avoid disrupting the agent's tool execution flow
      // In a production environment, this would be logged via logger-utility
    }
  }

  /**
   * Called by hooks when the session is ending.
   * Performs a final cleanup and compaction to ensure the session file is optimized for storage.
   */
  async onSessionEnd(): Promise<void> {
    try {
      const entries = await this.loadSessionEntries();
      await this.trigger.checkAndCompact(this.sessionId, entries);
    } catch (error) {
      // Final end-of-session cleanup failure is non-critical
    }
  }

  /**
   * Called by hooks when a session starts.
   * Ensures the session state is initialized and check for any immediate capping needs if resuming.
   */
  async onSessionStart(sessionId: string): Promise<void> {
    this.sessionId = sessionId;
    try {
      const entries = await this.loadSessionEntries();
      await this.trigger.checkAndCompact(this.sessionId, entries);
    } catch (error) {
      // Session start check is advisory; don't block the session if it fails
    }
  }

  /**
   * Loads session entries from the .jsonl state file.
   */
  private async loadSessionEntries(): Promise<SessionEntry[]> {
    const filePath = path.join(process.cwd(), `.session-state-${this.sessionId}.jsonl`);

    try {
      const content = await fs.readFile(filePath, 'utf8');
      return content
        .split('\n')
        .filter(line => line.trim() !== '')
        .map(line => JSON.parse(line) as SessionEntry);
    } catch (error) {
      // If file doesn't exist, return empty array
      return [];
    }
  }
}
