import { success, failure, type Result } from '@/seed/types/result';

export interface BlackboardEntry {
  id: string;
  type: 'decision' | 'constraint' | 'anchor' | 'finding' | 'error';
  key: string;
  value: string;
  timestamp: number;
  turnId: string;
  pinned: boolean; // anchor messages that survive purges
}

export class BlackboardStore {
  private entries: Map<string, BlackboardEntry> = new Map();
  private sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  write(entry: Omit<BlackboardEntry, 'id' | 'timestamp'>): BlackboardEntry {
    const id = `fact_${Math.random().toString(36).substring(2, 11)}`;
    const newEntry: BlackboardEntry = {
      ...entry,
      id,
      timestamp: Date.now(),
    };
    this.entries.set(newEntry.key, newEntry);
    return newEntry;
  }

  read(key: string): BlackboardEntry | undefined {
    return this.entries.get(key);
  }

  readByType(type: BlackboardEntry['type']): BlackboardEntry[] {
    return Array.from(this.entries.values()).filter((e) => e.type === type);
  }

  pin(key: string): void {
    const entry = this.entries.get(key);
    if (entry) {
      this.entries.set(key, { ...entry, pinned: true });
    }
  }

  unpin(key: string): void {
    const entry = this.entries.get(key);
    if (entry) {
      this.entries.set(key, { ...entry, pinned: false });
    }
  }

  getPinned(): BlackboardEntry[] {
    return Array.from(this.entries.values()).filter((e) => e.pinned);
  }

  compact(maxEntries: number): { kept: BlackboardEntry[]; purged: number } {
    const allEntries = Array.from(this.entries.values()).sort(
      (a, b) => b.timestamp - a.timestamp
    );

    const kept: BlackboardEntry[] = [];
    let purgedCount = 0;

    for (const entry of allEntries) {
      if (entry.pinned || kept.length < maxEntries) {
        kept.push(entry);
      } else {
        this.entries.delete(entry.key);
        purgedCount++;
      }
    }

    return { kept, purged: purgedCount };
  }

  exportState(): string {
    return JSON.stringify(Array.from(this.entries.values()));
  }

  importState(json: string): void {
    try {
      const data: BlackboardEntry[] = JSON.parse(json);
      for (const entry of data) {
        this.entries.set(entry.key, entry);
      }
    } catch (e) {
      // Log error or handle accordingly via logger utility
    }
  }
}
