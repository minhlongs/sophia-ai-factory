import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CheckpointService } from '@/forest/pipeline';
import Database from 'better-sqlite3';

// ── In-memory SQLite D1 mock ──────────────────────────────────────────────────
// Cache the DB instance so createServerClient() calls share state.

let cachedDb: any = null;

function createMockD1Client() {
  if (!cachedDb) {
    cachedDb = new Database(':memory:');
    cachedDb.exec(`CREATE TABLE IF NOT EXISTS pipeline_checkpoints (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, pipeline_id TEXT NOT NULL,
      pipeline_type TEXT NOT NULL DEFAULT 'video_generation', stage TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'in_progress', artifacts_json TEXT DEFAULT '{}',
      decision_log_ref TEXT, error TEXT, metadata_json TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(tenant_id, pipeline_id, stage)
    );
    CREATE TABLE IF NOT EXISTS pipeline_decision_logs (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, pipeline_id TEXT NOT NULL,
      decision_id TEXT NOT NULL, decision_type TEXT NOT NULL, stage TEXT NOT NULL,
      payload_json TEXT DEFAULT '{}', created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(tenant_id, pipeline_id, decision_id)
    )`);
  }
  const db = cachedDb;

function makeStmt(sql: string, stmt: { bind: (...vals: unknown[]) => { run: (...v: unknown[]) => { changes: number; lastInsertRowid: number | bigint | null }; get: (...v: unknown[]) => unknown; all: () => unknown[] }; run: (...v: unknown[]) => { changes: number; lastInsertRowid: number | bigint | null }; get: (...v: unknown[]) => unknown; all: () => unknown[] }) {
  const isInsert = sql.trim().toUpperCase().startsWith('INSERT');

  const bind = (...vals: unknown[]) => {
    const bs = stmt.bind(...vals);
    const bound = [...vals];
    const obj: any = {
      bind: (...v: unknown[]) => bind(...v),
      run: (...v: unknown[]) => v.length ? bs.run(...v) : bs.run(),
      all: () => ({ results: bs.all() }),
      first: () => { const row = bs.get(); return row ?? null; },
      get: () => { const row = bs.get(); return row ?? null; },
    };
    if (isInsert) {
      obj.all = () => ({ results: [] });
      obj.first = () => {
        const result = bs.run();
        const rowid = result.lastInsertRowid;
        if (rowid) {
          const row = db.prepare('SELECT id FROM pipeline_checkpoints WHERE rowid = ?').get(rowid);
          return row ?? { id: 'mock-' + Math.random().toString(36).slice(2, 10) };
        }
        return { id: 'mock-' + Math.random().toString(36).slice(2, 10) };
      };
    }
    return obj;
  };

  const obj: any = {
    bind,
    run: (...v: unknown[]) => stmt.run(...v),
    all: () => ({ results: stmt.all() }),
    first: () => { const row = stmt.get(); return row ?? null; },
    get: () => { const row = stmt.get(); return row ?? null; },
  };
  if (isInsert) {
    obj.all = () => ({ results: [] });
    obj.first = () => {
      const result = stmt.run();
      const rowid = result.lastInsertRowid;
      if (rowid) {
        const row = db.prepare('SELECT id FROM pipeline_checkpoints WHERE rowid = ?').get(rowid);
        return row ?? { id: 'mock-' + Math.random().toString(36).slice(2, 10) };
      }
      return { id: 'mock-' + Math.random().toString(36).slice(2, 10) };
    };
  }
  return obj;
}

  const client: any = {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      return makeStmt(sql, stmt);
    },
    exec(sql: string) { db.exec(sql); },
    batch(stmts: Array<{ run: () => unknown }>) { return stmts.map((s: any) => s.run()); },
    unwrap() {
      return {
        batch(stmts: Array<{ run: () => unknown }>) { return stmts.map((s: any) => s.run()); },
        prepare(sql: string) {
          const stmt = db.prepare(sql);
          return makeStmt(sql, stmt);
        },
      };
    },
  };
  return client;
}

function clearAll() {
  if (cachedDb) {
    cachedDb.exec("DELETE FROM pipeline_decision_logs; DELETE FROM pipeline_checkpoints;");
  }
}

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(() => createMockD1Client()),
}));

beforeEach(() => { clearAll(); });

// ── Tests ─────────────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-checkpoint-test';
const PIPELINE_ID = 'pipeline-abc-123';

function svc() { return new CheckpointService(TENANT_ID); }

describe('CheckpointService', () => {
  it('writes and reads a checkpoint', async () => {
    const service = svc();
    const id = await service.writeCheckpoint(PIPELINE_ID, 'visual', 'completed', {
      asset_manifest: {
        audioR2Key: 'audio.mp3', videoR2Key: 'video.mp4',
        brandKitApplied: false,
        assets: [{ type: 'audio', r2Key: 'audio.mp3', mimeType: 'audio/mpeg' }],
      },
    });
    expect(id).toBeTruthy();
    const read = await service.readCheckpoint(PIPELINE_ID, 'visual');
    expect(read).not.toBeNull();
    expect(read!.pipelineId).toBe(PIPELINE_ID);
    expect(read!.stage).toBe('visual');
    expect(read!.status).toBe('completed');
    expect(read!.pipelineType).toBe('video_generation');
  });

  it('getLatestCheckpoint returns most recent', async () => {
    const service = svc();
    await service.writeCheckpoint(PIPELINE_ID, 'parse_input', 'completed', {
      research_brief: { prompt: 'test', voiceoverText: 'hello', language: 'en' },
    });
    await new Promise((r) => setTimeout(r, 10));
    await service.writeCheckpoint(PIPELINE_ID, 'generate_tts', 'completed', {
      asset_manifest: { audioR2Key: 'a.mp3', brandKitApplied: false, assets: [] },
    });
    const latest = await service.getLatestCheckpoint(PIPELINE_ID);
    expect(latest).not.toBeNull();
    expect(latest!.stage).toBe('generate_tts');
  });

  it('getCompletedStages returns only completed stages', async () => {
    const service = svc();
    await service.writeCheckpoint(PIPELINE_ID, 'parse_input', 'completed', {
      research_brief: { prompt: 'test', voiceoverText: 'hello', language: 'en' },
    });
    await service.writeCheckpoint(PIPELINE_ID, 'generate_tts', 'completed', {
      asset_manifest: { audioR2Key: 'a.mp3', brandKitApplied: false, assets: [] },
    });
    await service.writeCheckpoint(PIPELINE_ID, 'generate_video', 'in_progress', {});
    const stages = await service.getCompletedStages(PIPELINE_ID);
    expect(stages).toEqual(['parse_input', 'generate_tts']);
  });

  it('getNextStage returns the next uncompleted stage', async () => {
    const service = svc();
    await service.writeCheckpoint(PIPELINE_ID, 'parse_input', 'completed', {
      research_brief: { prompt: 'test', voiceoverText: 'hello', language: 'en' },
    });
    const next = await service.getNextStage(PIPELINE_ID);
    expect(next).toBe('generate_tts');
  });

  it('getNextStage returns null when all stages completed', async () => {
    const service = svc();
    const stages = ['parse_input','generate_tts','generate_video','poll_video_ready','download_video','generate_subtitles','mux_audio_video','update_mission','emit_usage'];
    for (const stage of stages) {
      await service.writeCheckpoint(PIPELINE_ID, stage, 'completed', {});
    }
    const next = await service.getNextStage(PIPELINE_ID);
    expect(next).toBeNull();
  });

  it('appendDecisionLog stores and retrieves decisions', async () => {
    const service = svc();
    await service.writeCheckpoint(PIPELINE_ID, 'visual', 'completed', {
      asset_manifest: { videoR2Key: 'v.mp4', brandKitApplied: false, assets: [] },
    });
    await service.appendDecisionLog(PIPELINE_ID, [
      { decisionId: 'dec-1', decisionType: 'style_selection', stage: 'visual', payload: { style: 'cinematic', confidence: 0.95 } },
    ]);
    const log = await service.getDecisionLog(PIPELINE_ID);
    expect(log).toHaveLength(1);
    expect(log[0].decisionId).toBe('dec-1');
    expect(log[0].decisionType).toBe('style_selection');
  });

  it('appendDecisionLog deduplicates by decisionId', async () => {
    const service = svc();
    await service.writeCheckpoint(PIPELINE_ID, 'visual', 'completed', {
      asset_manifest: { videoR2Key: 'v.mp4', brandKitApplied: false, assets: [] },
    });
    await service.appendDecisionLog(PIPELINE_ID, [
      { decisionId: 'dec-dup', decisionType: 'style', stage: 'visual', payload: { style: 'cinematic' } },
    ]);
    await service.appendDecisionLog(PIPELINE_ID, [
      { decisionId: 'dec-dup', decisionType: 'style', stage: 'visual', payload: { style: 'documentary' } },
    ]);
    const log = await service.getDecisionLog(PIPELINE_ID);
    expect(log).toHaveLength(1);
    expect(log[0].payload).toEqual({ style: 'cinematic' });
  });

  it('upserts: second write overwrites the first', async () => {
    const service = svc();
    await service.writeCheckpoint(PIPELINE_ID, 'visual', 'completed', {
      asset_manifest: { videoR2Key: 'v1.mp4', brandKitApplied: false, assets: [] },
    });
    await service.writeCheckpoint(PIPELINE_ID, 'visual', 'failed', {
      asset_manifest: { videoR2Key: 'v1.mp4', brandKitApplied: false, assets: [] },
    }, { error: 'Processing failed' });
    const read = await service.readCheckpoint(PIPELINE_ID, 'visual');
    expect(read).not.toBeNull();
    expect(read!.status).toBe('failed');
    expect(read!.error).toBe('Processing failed');
  });

  it('tenant isolation: checkpoints are tenant-scoped', async () => {
    const serviceA = new CheckpointService('tenant-a');
    const serviceB = new CheckpointService('tenant-b');
    await serviceA.writeCheckpoint(PIPELINE_ID, 'visual', 'completed', {
      asset_manifest: { videoR2Key: 'v.mp4', brandKitApplied: false, assets: [] },
    });
    const readB = await serviceB.readCheckpoint(PIPELINE_ID, 'visual');
    expect(readB).toBeNull();
  });

  it('tenant isolation: decision logs are tenant-scoped', async () => {
    const serviceA = new CheckpointService('tenant-a');
    const serviceB = new CheckpointService('tenant-b');
    await serviceA.writeCheckpoint(PIPELINE_ID, 'visual', 'completed', {
      asset_manifest: { videoR2Key: 'v.mp4', brandKitApplied: false, assets: [] },
    });
    await serviceA.appendDecisionLog(PIPELINE_ID, [
      { decisionId: 'dec-1', decisionType: 'style', stage: 'visual', payload: { style: 'cinematic' } },
    ]);
    const logB = await serviceB.getDecisionLog(PIPELINE_ID);
    expect(logB).toHaveLength(0);
  });

  it('cross-pipeline isolation: different pipeline IDs do not leak', async () => {
    const service = svc();
    await service.writeCheckpoint('pipeline-1', 'visual', 'completed', {
      asset_manifest: { videoR2Key: 'v.mp4', brandKitApplied: false, assets: [] },
    });
    const read = await service.readCheckpoint('pipeline-2', 'visual');
    expect(read).toBeNull();
  });

  it('getLatestCheckpoint returns most recent across stages', async () => {
    const service = svc();
    await service.writeCheckpoint(PIPELINE_ID, 'parse_input', 'completed', {
      research_brief: { prompt: 'test', voiceoverText: 'hello', language: 'en' },
    });
    await new Promise((r) => setTimeout(r, 10));
    await service.writeCheckpoint(PIPELINE_ID, 'generate_tts', 'completed', {
      asset_manifest: { audioR2Key: 'a.mp3', brandKitApplied: false, assets: [] },
    });
    const latest = await service.getLatestCheckpoint(PIPELINE_ID);
    expect(latest).not.toBeNull();
    expect(latest!.stage).toBe('generate_tts');
  });
});

describe('CheckpointService — extended', () => {
  it('writeCheckpoint with decisionLog appends to decision log', async () => {
    const service = svc();
    const id = await service.writeCheckpoint(PIPELINE_ID, 'visual', 'completed', {
      asset_manifest: { videoR2Key: 'v.mp4', brandKitApplied: false, assets: [] },
    }, {
      decisionLog: [
        { decisionId: 'dl-1', decisionType: 'voice_selection', stage: 'visual', payload: { voice: 'nova', reason: 'warm tone' } },
      ],
    });
    expect(id).toBeTruthy();
    const log = await service.getDecisionLog(PIPELINE_ID);
    expect(log).toHaveLength(1);
    expect(log[0].decisionId).toBe('dl-1');
  });

  it('decision log merge: appending to existing log accumulates entries', async () => {
    const service = svc();
    await service.writeCheckpoint(PIPELINE_ID, 'visual', 'completed', {
      asset_manifest: { videoR2Key: 'v.mp4', brandKitApplied: false, assets: [] },
    });
    await service.appendDecisionLog(PIPELINE_ID, [
      { decisionId: 'd1', decisionType: 't1', stage: 'visual', payload: { a: 1 } },
    ]);
    await service.appendDecisionLog(PIPELINE_ID, [
      { decisionId: 'd2', decisionType: 't2', stage: 'visual', payload: { b: 2 } },
    ]);
    const log = await service.getDecisionLog(PIPELINE_ID);
    expect(log).toHaveLength(2);
    expect(log[0].decisionId).toBe('d1');
    expect(log[1].decisionId).toBe('d2');
  });

  it('decision log dedup: same decisionId written twice stays at 1', async () => {
    const service = svc();
    await service.writeCheckpoint(PIPELINE_ID, 'visual', 'completed', {
      asset_manifest: { videoR2Key: 'v.mp4', brandKitApplied: false, assets: [] },
    });
    await service.appendDecisionLog(PIPELINE_ID, [
      { decisionId: 'dx', decisionType: 't', stage: 'visual', payload: { v: 1 } },
    ]);
    await service.appendDecisionLog(PIPELINE_ID, [
      { decisionId: 'dx', decisionType: 't', stage: 'visual', payload: { v: 2 } },
    ]);
    const log = await service.getDecisionLog(PIPELINE_ID);
    expect(log).toHaveLength(1);
  });

  it('getDecisionLog returns entries ordered by creation time', async () => {
    const service = svc();
    await service.writeCheckpoint(PIPELINE_ID, 'visual', 'completed', {
      asset_manifest: { videoR2Key: 'v.mp4', brandKitApplied: false, assets: [] },
    });
    await service.appendDecisionLog(PIPELINE_ID, [
      { decisionId: 'first', decisionType: 't', stage: 'visual', payload: { order: 1 } },
    ]);
    await new Promise((r) => setTimeout(r, 10));
    await service.appendDecisionLog(PIPELINE_ID, [
      { decisionId: 'second', decisionType: 't', stage: 'visual', payload: { order: 2 } },
    ]);
    const log = await service.getDecisionLog(PIPELINE_ID);
    expect(log).toHaveLength(2);
    expect(log[0].decisionId).toBe('first');
    expect(log[1].decisionId).toBe('second');
  });

  it('stage progression: sequential stages advance correctly', async () => {
    const service = svc();
    await service.writeCheckpoint(PIPELINE_ID, 'parse_input', 'completed', {
      research_brief: { prompt: 'test', voiceoverText: 'hello', language: 'en' },
    });
    const next = await service.getNextStage(PIPELINE_ID);
    expect(next).toBe('generate_tts');
  });

  it('stage progression: skipped stage is not counted as completed', async () => {
    const service = svc();
    await service.writeCheckpoint(PIPELINE_ID, 'parse_input', 'completed', {
      research_brief: { prompt: 'test', voiceoverText: 'hello', language: 'en' },
    });
    await service.writeCheckpoint(PIPELINE_ID, 'generate_tts', 'skipped', {
      asset_manifest: { audioR2Key: 'a.mp3', brandKitApplied: false, assets: [] },
    });
    const completed = await service.getCompletedStages(PIPELINE_ID);
    expect(completed).toEqual(['parse_input']);
    const next = await service.getNextStage(PIPELINE_ID);
    expect(next).toBe('generate_tts');
  });

  it('stage progression: failed stage is not counted as completed', async () => {
    const service = svc();
    await service.writeCheckpoint(PIPELINE_ID, 'parse_input', 'completed', {
      research_brief: { prompt: 'test', voiceoverText: 'hello', language: 'en' },
    });
    await service.writeCheckpoint(PIPELINE_ID, 'generate_tts', 'failed', {
      asset_manifest: { audioR2Key: 'a.mp3', brandKitApplied: false, assets: [] },
    }, { error: 'TTS provider timeout' });
    const completed = await service.getCompletedStages(PIPELINE_ID);
    expect(completed).toEqual(['parse_input']);
  });

  it('schema validation: invalid artifact for stage throws', async () => {
    const service = svc();
    await expect(
      service.writeCheckpoint(PIPELINE_ID, 'visual', 'completed', {
        asset_manifest: { invalid: true },
      }),
    ).rejects.toThrow();
  });

  it('schema validation: valid ResearchBrief passes', async () => {
    const service = svc();
    const id = await service.writeCheckpoint(PIPELINE_ID, 'parse_input', 'completed', {
      research_brief: { prompt: 'test', voiceoverText: 'hello', language: 'en' },
    });
    expect(id).toBeTruthy();
    const read = await service.readCheckpoint(PIPELINE_ID, 'parse_input');
    expect(read).not.toBeNull();
    expect(read!.stage).toBe('parse_input');
  });

  it('writeCheckpoint with metadata stores and retrieves metadata', async () => {
    const service = svc();
    const id = await service.writeCheckpoint(PIPELINE_ID, 'visual', 'completed', {
      asset_manifest: { videoR2Key: 'v.mp4', brandKitApplied: false, assets: [] },
    }, {
      metadata: { costSnapshot: { totalSpentUsd: 1.5 }, stylePlaybook: 'cinematic' },
    });
    expect(id).toBeTruthy();
    const read = await service.readCheckpoint(PIPELINE_ID, 'visual');
    expect(read).not.toBeNull();
    expect(read!.metadata).toEqual(
      expect.objectContaining({
        costSnapshot: { totalSpentUsd: 1.5 },
        stylePlaybook: 'cinematic',
      }),
    );
  });

  it('writeCheckpoint with error field stores error', async () => {
    const service = svc();
    const id = await service.writeCheckpoint(PIPELINE_ID, 'generate_video', 'failed', {
      asset_manifest: { videoR2Key: 'v.mp4', brandKitApplied: false, assets: [] },
    }, { error: 'Video generation timed out after 120s' });
    expect(id).toBeTruthy();
    const read = await service.readCheckpoint(PIPELINE_ID, 'generate_video');
    expect(read).not.toBeNull();
    expect(read!.status).toBe('failed');
    expect(read!.error).toBe('Video generation timed out after 120s');
  });

  it('repurpose pipeline uses correct stage order', async () => {
    const service = new CheckpointService(TENANT_ID);
    await service.writeCheckpoint(PIPELINE_ID, 'analyze', 'completed', {}, { pipelineType: 'video_repurpose' });
    const next = await service.getNextStage(PIPELINE_ID);
    expect(next).toBe('clip_generate');
  });

  it('campaign pipeline uses correct stage order', async () => {
    const service = new CheckpointService(TENANT_ID);
    await service.writeCheckpoint(PIPELINE_ID, 'scripting', 'completed', {
      script: {
        segments: [{ id: 's1', text: 'hello', startSec: 0, endSec: 5 }],
        totalDurationSec: 5, wordCount: 1, language: 'en',
      },
    }, { pipelineType: 'campaign' });
    const next = await service.getNextStage(PIPELINE_ID);
    expect(next).toBe('tts');
  });

  it('getNextStage returns null for unknown pipeline type', async () => {
    // PipelineTypeSchema now accepts any string; getNextStage returns null for unknown types
    const service = new CheckpointService(TENANT_ID);
    await service.writeCheckpoint(PIPELINE_ID, 'custom_stage', 'completed', {}, { pipelineType: 'nonexistent_pipeline' });
    const next = await service.getNextStage(PIPELINE_ID);
    expect(next).toBeNull();
  });

  it('no decisionLog option does not create log entries', async () => {
    const service = svc();
    await service.writeCheckpoint(PIPELINE_ID, 'visual', 'completed', {
      asset_manifest: { videoR2Key: 'v.mp4', brandKitApplied: false, assets: [] },
    });
    const log = await service.getDecisionLog(PIPELINE_ID);
    expect(log).toHaveLength(0);
  });
});
