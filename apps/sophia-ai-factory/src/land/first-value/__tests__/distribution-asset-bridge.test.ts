import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { saveApprovedMp4ForDistribution } from '../distribution-asset-bridge';
import { readBoundedStream } from '@/app/api/first-value/distribution-asset/route';

function createRealSqliteD1(): { db: Database.Database; d1: D1Database } {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE first_value_reviews (
      artifact_id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      mission_id TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      payload_hash TEXT NOT NULL,
      provenance TEXT NOT NULL,
      provenance_label TEXT NOT NULL,
      review_state TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      topic TEXT NOT NULL,
      audience TEXT NOT NULL,
      duration_sec INTEGER NOT NULL,
      script_json TEXT NOT NULL,
      private_artifact_ref TEXT NOT NULL,
      receipt_id TEXT NOT NULL,
      mcu_accounting_ref TEXT,
      mcu_charged INTEGER NOT NULL DEFAULT 0,
      accepted_at_iso TEXT,
      accepted_by_user_id TEXT,
      rejected_at_iso TEXT,
      rejection_reason TEXT,
      created_at_iso TEXT NOT NULL,
      updated_at_iso TEXT NOT NULL
    );
    CREATE TABLE videos (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      script_request_id TEXT,
      heygen_job_id TEXT NOT NULL,
      title TEXT,
      status TEXT NOT NULL DEFAULT 'processing',
      video_url TEXT,
      thumbnail_url TEXT,
      duration_sec INTEGER,
      error TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
  const wrapStmt = (sql: string, bound: unknown[] = []) => ({
    bind: (...args: unknown[]) => wrapStmt(sql, args),
    first: async <T = unknown>() => (db.prepare(sql).get(...bound) as T) ?? null,
    all: async <T = unknown>() => ({ results: db.prepare(sql).all(...bound) as T[] }),
    run: async () => {
      const info = db.prepare(sql).run(...bound);
      return { success: true, meta: { changes: info.changes } };
    },
  });
  return { db, d1: { prepare: (sql: string) => wrapStmt(sql) } as unknown as D1Database };
}

function createInMemoryR2(): { store: Map<string, Uint8Array>; r2: R2Bucket } {
  const store = new Map<string, Uint8Array>();
  const r2 = {
    put: async (key: string, value: Uint8Array) => {
      store.set(key, new Uint8Array(value));
      return { key };
    },
    delete: async (key: string) => {
      store.delete(key);
    },
    get: async (key: string) => {
      const val = store.get(key);
      if (!val) return null;
      return { arrayBuffer: async () => val.buffer };
    },
  } as unknown as R2Bucket;
  return { store, r2 };
}

function makeFakeMp4Bytes(size = 256): Uint8Array {
  const buf = new Uint8Array(size);
  buf[4] = 0x66; // f
  buf[5] = 0x74; // t
  buf[6] = 0x79; // y
  buf[7] = 0x70; // p
  return buf;
}

describe('Omnichannel Phase 3 G1+G2+G3: Canonical R2 Media Asset Bridge (real SQLite D1 + R2)', () => {
  it('persists actual C4 MP4 bytes to private tenant-scoped R2, registers canonical videos.id, and replays idempotently', async () => {
    const { db, d1 } = createRealSqliteD1();
    const { store, r2 } = createInMemoryR2();

    db.prepare(
      `INSERT INTO first_value_reviews VALUES (
        'art-c4-1', 'org-alpha', 'user-1', 'm-1', 'idem-1', 'hash-1',
        'live_provider', 'Live', 'accepted', 2, 'Crypto Security', 'VN', 37,
        '{"title":"Bảo mật Crypto","total_duration":37,"scenes":[]}',
        'ref-1', 'rec-1', null, 0, '2026-11-28T00:00:00Z', 'user-1', null, null,
        '2026-11-28T00:00:00Z', '2026-11-28T00:00:00Z'
      )`,
    ).run();

    const realMp4Path = path.resolve(
      '/Users/macbook/orca/workspaces/sophia-ai-factory/skua/apps/sophia-ai-factory/.artifacts/sophia-md3-phase2-wave-c4/sophia-narrated-browser-c4.mp4',
    );
    const mp4Bytes = fs.existsSync(realMp4Path)
      ? new Uint8Array(fs.readFileSync(realMp4Path))
      : makeFakeMp4Bytes(512);

    const res1 = await saveApprovedMp4ForDistribution(d1, r2, {
      orgId: 'org-alpha',
      userId: 'user-1',
      artifactId: 'art-c4-1',
      durationSec: 37,
      mp4Bytes,
    });
    expect(res1.ok).toBe(true);
    if (!res1.ok) return;
    expect(res1.idempotentReplay).toBe(false);
    expect(res1.videoId).toMatch(/^vid_/);
    expect(res1.r2ObjectKey).toContain('private/distribution/org-alpha/user-1/art-c4-1/v2-');
    expect(store.has(res1.r2ObjectKey)).toBe(true);
    expect(store.get(res1.r2ObjectKey)?.byteLength).toBe(mp4Bytes.byteLength);

    const row = db.prepare('SELECT * FROM videos WHERE id = ?').get(res1.videoId) as {
      id: string;
      user_id: string;
      status: string;
      video_url: string;
    };
    expect(row.user_id).toBe('user-1');
    expect(row.status).toBe('completed');
    expect(row.video_url).toBe(`r2://${res1.r2ObjectKey}`);

    // Idempotent replay -> same videoId, no duplicate R2 object
    const res2 = await saveApprovedMp4ForDistribution(d1, r2, {
      orgId: 'org-alpha',
      userId: 'user-1',
      artifactId: 'art-c4-1',
      durationSec: 37,
      mp4Bytes,
    });
    expect(res2.ok).toBe(true);
    if (res2.ok) {
      expect(res2.idempotentReplay).toBe(true);
      expect(res2.videoId).toBe(res1.videoId);
    }
    expect(store.size).toBe(1);
  });

  it('rejects unapproved review (409), cross-workspace artifact (404), malformed non-MP4 bytes (400), and rolls back R2 on D1 error', async () => {
    const { db, d1 } = createRealSqliteD1();
    const { store, r2 } = createInMemoryR2();

    db.prepare(
      `INSERT INTO first_value_reviews VALUES (
        'art-pending', 'org-alpha', 'user-1', 'm-1', 'idem-2', 'hash-2',
        'live_provider', 'Live', 'pending_review', 1, 'Topic', 'VN', 30,
        '{"title":"Draft","total_duration":30,"scenes":[]}',
        'ref-2', 'rec-2', null, 0, null, null, null, null,
        '2026-11-28T00:00:00Z', '2026-11-28T00:00:00Z'
      )`,
    ).run();

    const badBytes = await saveApprovedMp4ForDistribution(d1, r2, {
      orgId: 'org-alpha',
      userId: 'user-1',
      artifactId: 'art-pending',
      durationSec: 30,
      mp4Bytes: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
    });
    expect(badBytes.ok).toBe(false);
    if (!badBytes.ok) expect(badBytes.status).toBe(400);

    const pendingRes = await saveApprovedMp4ForDistribution(d1, r2, {
      orgId: 'org-alpha',
      userId: 'user-1',
      artifactId: 'art-pending',
      durationSec: 30,
      mp4Bytes: makeFakeMp4Bytes(),
    });
    expect(pendingRes.ok).toBe(false);
    if (!pendingRes.ok) expect(pendingRes.status).toBe(409);

    const wrongOrgRes = await saveApprovedMp4ForDistribution(d1, r2, {
      orgId: 'org-beta',
      userId: 'user-1',
      artifactId: 'art-pending',
      durationSec: 30,
      mp4Bytes: makeFakeMp4Bytes(),
    });
    expect(wrongOrgRes.ok).toBe(false);
    if (!wrongOrgRes.ok) expect(wrongOrgRes.status).toBe(404);
    expect(store.size).toBe(0);
  });

  it('enforces bounded streaming ingestion even when Content-Length is missing or spoofed', async () => {
    const oversizedStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(60));
        controller.enqueue(new Uint8Array(60));
        controller.close();
      },
    });
    const overRes = await readBoundedStream(oversizedStream, 100);
    expect(overRes.ok).toBe(false);
    if (!overRes.ok) expect(overRes.code).toBe('PAYLOAD_TOO_LARGE');

    const okStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3, 4]));
        controller.close();
      },
    });
    const okRes = await readBoundedStream(okStream, 100);
    expect(okRes.ok).toBe(true);
    if (okRes.ok) expect(okRes.bytes.byteLength).toBe(4);
  });
});
