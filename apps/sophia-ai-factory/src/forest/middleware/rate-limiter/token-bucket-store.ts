import { CacheEntry } from './types';

export class TokenBucketStore {
  private cache = new Map<string, CacheEntry>();
  private readonly maxCacheSize: number;

  constructor(maxCacheSize = 10000) {
    this.maxCacheSize = maxCacheSize;
  }

  get(key: string): CacheEntry | undefined {
    return this.cache.get(key);
  }

  set(key: string, entry: CacheEntry): void {
    this.cache.set(key, entry);
    this.evictIfNecessary();
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  private evictIfNecessary(): void {
    if (this.cache.size <= this.maxCacheSize) return;

    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].expiresAt - b[1].expiresAt);

    const toRemove = Math.floor(this.maxCacheSize * 0.1);
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }
  }
}
