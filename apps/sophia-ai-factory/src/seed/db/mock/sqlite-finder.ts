import * as path from 'path';
import * as fs from 'fs';
import type { SqliteDb } from './types';

// Apply canonical D1 migrations so the local mock mirrors production schema.
// Failures are non-fatal: migrations with ALTER/DROP on partially-migrated
// state are skipped, and CREATE TABLE IF NOT EXISTS is idempotent.
export function applyMigrations(db: SqliteDb): void {
  try {
    const cwd = ((globalThis as unknown) as Record<string, { cwd?: () => string }>).process?.cwd?.() || '';
    const candidates = [
      path.resolve(cwd, 'migrations'),
      path.resolve(cwd, '../../migrations'),
      path.resolve(cwd, '..', 'migrations'),
      path.resolve(cwd, 'apps/sophia-ai-factory/migrations'),
    ];
    const migDir = candidates.find(dir => fs.existsSync(dir));
    if (!migDir) return;
    const files = fs.readdirSync(migDir).filter((f: string) => f.endsWith('.sql')).sort();
    for (const f of files) {
      try {
        db.exec(fs.readFileSync(path.join(migDir, f), 'utf-8'));
      } catch {
        // Non-fatal: skip migrations that depend on partial state
      }
    }
  } catch {
    // Non-fatal: migrations are best-effort for the local mock
  }
}

export function getFileMtimeWithWal(filePath: string): number {
  let maxFileTime = 0;
  for (const ext of ['', '-wal', '-shm']) {
    try {
      const stats = fs.statSync(filePath + ext);
      if (stats.mtimeMs > maxFileTime) {
        maxFileTime = stats.mtimeMs;
      }
    } catch {
      // Ignore missing wal/shm files
    }
  }
  return maxFileTime;
}

export function findNewestSqliteInDir(baseDir: string): { file: string; time: number } | null {
  if (!fs.existsSync(baseDir)) return null;
  try {
    const files = fs
      .readdirSync(baseDir)
      .filter((f: string) => f.endsWith('.sqlite') && !f.includes('metadata'))
      .map((f: string) => path.join(baseDir, f));

    let newestFile: string | null = null;
    let newestTime = 0;

    for (const file of files) {
      const fileTime = getFileMtimeWithWal(file);
      if (fileTime > newestTime) {
        newestTime = fileTime;
        newestFile = file;
      }
    }
    return newestFile ? { file: newestFile, time: newestTime } : null;
  } catch {
    return null;
  }
}

export function findLocalD1Path(): string | null {
  if (typeof (globalThis as Record<string, unknown>).EdgeRuntime !== 'undefined' && process.env.NODE_ENV === 'production') {
    return null;
  }

  try {
    const cwd = ((globalThis as unknown) as Record<string, { cwd?: () => string }>).process?.cwd?.() || '';
    const homeDir = ((globalThis as unknown) as Record<string, { env?: Record<string, string | undefined> }>).process?.env?.HOME || '';
    const candidates = [
      path.resolve(cwd, '../..', '.wrangler/state/v3/d1/miniflare-D1DatabaseObject'),
      path.resolve(cwd, '.wrangler/state/v3/d1/miniflare-D1DatabaseObject'),
      path.resolve(cwd, '..', '.wrangler/state/v3/d1/miniflare-D1DatabaseObject'),
      ...(homeDir ? [
        path.resolve(homeDir, '.wrangler/state/v3/d1/miniflare-D1DatabaseObject'),
        path.resolve(homeDir, '.wrangler/state/v3/d1'),
      ] : []),
    ];

    let newestFile: string | null = null;
    let newestTime = 0;

    for (const base of candidates) {
      const found = findNewestSqliteInDir(base);
      if (found && found.time > newestTime) {
        newestTime = found.time;
        newestFile = found.file;
      }
    }
    return newestFile;
  } catch {
    return null;
  }
}
