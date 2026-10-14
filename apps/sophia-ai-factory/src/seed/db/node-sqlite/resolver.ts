import * as fs from 'node:fs';
import * as path from 'node:path';
import { NodeSqliteD1Database } from './database';

/**
 * Resolve a writable local D1 shim for dev/test. Returns null when the
 * node:sqlite built-in is unavailable or no local DB file can be found.
 */
export function getLocalNodeSqliteD1(): NodeSqliteD1Database | null {
  try {
    const cwd = (process as unknown as { cwd?: () => string }).cwd?.() ?? '';
    const homeDir = (process as unknown as { env?: Record<string, string | undefined> }).env?.HOME ?? '';
    const candidates = [
      path.resolve(cwd, '../..', '.wrangler/state/v3/d1/miniflare-D1DatabaseObject'),
      path.resolve(cwd, '.wrangler/state/v3/d1/miniflare-D1DatabaseObject'),
      path.resolve(cwd, '..', '.wrangler/state/v3/d1/miniflare-D1DatabaseObject'),
      ...(homeDir
        ? [
            path.resolve(homeDir, '.wrangler/state/v3/d1/miniflare-D1DatabaseObject'),
            path.resolve(homeDir, '.wrangler/state/v3/d1'),
          ]
        : []),
    ];

    let newestFile: string | null = null;
    let newestTime = 0;
    for (const base of candidates) {
      if (!fs.existsSync(base)) continue;
      const files = fs
        .readdirSync(base)
        .filter((f: string) => f.endsWith('.sqlite') && !f.includes('metadata'))
        .map((f: string) => path.join(base, f));
      for (const file of files) {
        let maxFileTime = 0;
        for (const ext of ['', '-wal', '-shm']) {
          try {
            const stats = fs.statSync(file + ext);
            if (stats.mtimeMs > maxFileTime) maxFileTime = stats.mtimeMs;
          } catch {}
        }
        if (maxFileTime > newestTime) {
          newestTime = maxFileTime;
          newestFile = file;
        }
      }
    }

    if (!newestFile) return null;
    return new NodeSqliteD1Database(newestFile);
  } catch {
    return null;
  }
}
