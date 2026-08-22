/**
 * Tests for the YouTube content pipeline Inngest function.
 *
 * Inngest is mocked so createFunction returns the raw handler; step.run is a
 * pass-through that records step names (verifies ordering + per-stage error
 * wrapping). D1 is mocked for config load + calendar insert. Stage runners,
 * the AI generator builder, and the checkpoint store are all mocked so the
 * tests isolate pipeline orchestration logic.
 *
 * @module forest/inngest/functions/__tests__/youtube-content-pipeline
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NonRetriableError } from 'inngest';

const mocks = vi.hoisted(() => {
  const captured: { cfg?: unknown; evt?: unknown } = {};
  const createFunction = vi.fn((_cfg: unknown, _evt: unknown, handler: unknown) => {
    captured.cfg = _cfg;
    captured.evt = _evt;
    return handler;
  });
  return {
    captured,
    createFunction,
    getD1Sync: vi.fn(),
    buildAIGenerateFn: vi.fn(),
    createCheckpointStore: vi.fn(),
    runStrategyStage: vi.fn(),
    runScriptStage: vi.fn(),
    runSEOStage: vi.fn(),
    runThumbnailStage: vi.fn(),
    runQualityGateStage: vi.fn(),
  };
});

vi.mock('@/seed/inngest/client', () => ({
  inngest: { createFunction: mocks.createFunction },
}));
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/seed/db/client', () => ({
  getD1Sync: mocks.getD1Sync,
}));
vi.mock('@/land/youtube/ai-generate-fn', () => ({
  buildAIGenerateFn: mocks.buildAIGenerateFn,
}));
vi.mock('@/land/youtube/pipeline-checkpoint-store', () => ({
  createCheckpointStore: mocks.createCheckpointStore,
}));
vi.mock('@/land/youtube/pipeline-stages', () => ({
  runStrategyStage: mocks.runStrategyStage,
  runScriptStage: mocks.runScriptStage,
  runSEOStage: mocks.runSEOStage,
  runThumbnailStage: mocks.runThumbnailStage,
  runQualityGateStage: mocks.runQualityGateStage,
}));

import { youtubeContentPipeline } from '../youtube-content-pipeline';

// ── Fixtures ────────────────────────────────────────────────────────────────

const USER_ID = 'user-1';
const CONFIG_ID = 'cfg-1';

const CONFIG_ROW: Record<string, unknown> = {
  objective: 'Grow subscribers',
  audience: 'Tech enthusiasts',
  content_pillars: '["AI","SaaS"]',
  cadence: '3-per-week',
  posts_per_week: 3,
  content_buffer_days: 3,
  autonomy_level: 2,
};

const STRATEGY = {
  topic: 'AI news',
  angle: 'The angle',
  targetAudience: 'Tech enthusiasts',
  contentType: 'Tutorial',
  keywords: ['ai'],
  estimatedViews: 1000,
  bestPublishTime: '2026-08-23T00:00:00Z',
};

const SCRIPT = {
  title: 'Script title',
  hook: { text: 'hook' },
  introduction: { greeting: 'hi' },
  mainContent: { sections: [] },
  conclusion: { recap: [] },
  callToAction: { text: 'subscribe' },
  duration: '8m',
  tone: 'energetic',
  pacing: 'fast',
  keywords: ['ai'],
  claims: [],
  fullScript: 'full script text',
};

const SEO = {
  title: 'SEO optimized title',
  description: 'SEO description',
  tags: ['ai', 'automation'],
  seoScore: 82,
};

const THUMBNAIL = { path: null, skipped: true, reason: 'No thumbnail key configured' };
const QUALITY_PASS = { passed: true, violations: [], warnings: [] };

interface PreparedStatement {
  sql: string;
  values: unknown[];
  method: 'first' | 'run';
}

function makeD1Mock(configRow: Record<string, unknown> | null) {
  const prepared: PreparedStatement[] = [];
  return {
    prepared,
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          return {
            first: async () => {
              prepared.push({ sql, values, method: 'first' });
              return configRow;
            },
            run: async () => {
              prepared.push({ sql, values, method: 'run' });
              return { success: true, meta: { changes: 1, duration: 0 } };
            },
          };
        },
      };
    },
  };
}

interface StepMock {
  calls: string[];
  run: (name: string, fn: () => Promise<unknown>) => Promise<unknown>;
}

function makeStep(): StepMock {
  const calls: string[] = [];
  return {
    calls,
    run: async (name: string, fn: () => Promise<unknown>) => {
      calls.push(name);
      return fn();
    },
  };
}

type PipelineHandler = (ctx: {
  event: { data: Record<string, unknown> };
  step: StepMock;
}) => Promise<{ success: boolean; jobId: string; stage: string; calendarId?: string }>;

const handler = youtubeContentPipeline as unknown as PipelineHandler;

function makeEvent(over: Record<string, unknown> = {}) {
  return {
    event: {
      data: { userId: USER_ID, channelConfigId: CONFIG_ID, topic: 'AI news', ...over },
    },
  };
}

let d1: ReturnType<typeof makeD1Mock>;
let checkpointStore: { saveGenerationCheckpoint: ReturnType<typeof vi.fn> };
let aiFn: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  d1 = makeD1Mock(CONFIG_ROW);
  mocks.getD1Sync.mockReturnValue(d1);
  aiFn = vi.fn(async () => 'ai response');
  mocks.buildAIGenerateFn.mockResolvedValue(aiFn);
  checkpointStore = { saveGenerationCheckpoint: vi.fn(async () => undefined) };
  mocks.createCheckpointStore.mockResolvedValue(checkpointStore);
  mocks.runStrategyStage.mockResolvedValue(STRATEGY);
  mocks.runScriptStage.mockResolvedValue(SCRIPT);
  mocks.runSEOStage.mockResolvedValue(SEO);
  mocks.runThumbnailStage.mockResolvedValue(THUMBNAIL);
  mocks.runQualityGateStage.mockResolvedValue(QUALITY_PASS);
});

// ── Function configuration ──────────────────────────────────────────────────

describe('function configuration', () => {
  it('registers with id youtube-content-pipeline and retries 2', () => {
    const cfg = mocks.captured.cfg as { id: string; retries: number };
    expect(cfg.id).toBe('youtube-content-pipeline');
    expect(cfg.retries).toBe(2);
  });

  it('listens for youtube.content.pipeline.requested', () => {
    const trigger = mocks.captured.evt as { event: string };
    expect(trigger.event).toBe('youtube.content.pipeline.requested');
  });
});

// ── Happy path + step ordering ──────────────────────────────────────────────

describe('happy path', () => {
  it('runs all stages and returns success with a calendar id', async () => {
    const step = makeStep();
    const result = await handler({ ...makeEvent(), step });

    expect(result.success).toBe(true);
    expect(result.stage).toBe('publish');
    expect(result.jobId).toContain(`pipe_${CONFIG_ID}_`);
    expect(typeof result.calendarId).toBe('string');
    expect(result.calendarId?.length).toBe(32);
  });

  it('runs steps in the exact expected order', async () => {
    const step = makeStep();
    await handler({ ...makeEvent(), step });

    expect(step.calls).toEqual([
      'load-channel-config',
      'build-ai-generator',
      'strategy',
      'script',
      'seo',
      'thumbnail',
      'quality-gate',
      'checkpoint',
      'publish',
    ]);
  });

  it('loads the channel config scoped to the event user', async () => {
    const step = makeStep();
    await handler({ ...makeEvent(), step });

    const loadStmt = d1.prepared.find((p) => p.method === 'first');
    expect(loadStmt?.sql).toContain('FROM youtube_channel_configs');
    expect(loadStmt?.values).toEqual([CONFIG_ID, USER_ID]);
  });

  it('passes the parsed config snapshot to the strategy stage', async () => {
    const step = makeStep();
    await handler({ ...makeEvent(), step });

    const [ctx, config] = mocks.runStrategyStage.mock.calls[0];
    expect(ctx.userId).toBe(USER_ID);
    expect(ctx.channelConfigId).toBe(CONFIG_ID);
    expect(ctx.topic).toBe('AI news');
    expect(ctx.generateText).toBe(aiFn);
    expect(config).toEqual({
      objective: 'Grow subscribers',
      audience: 'Tech enthusiasts',
      contentPillars: ['AI', 'SaaS'],
      cadence: '3-per-week',
      postsPerWeek: 3,
      bufferDays: 3,
      autonomyLevel: 2,
    });
  });

  it('builds the AI generator with the event userId', async () => {
    const step = makeStep();
    await handler({ ...makeEvent(), step });
    expect(mocks.buildAIGenerateFn).toHaveBeenCalledWith(USER_ID);
  });

  it('chains stage outputs: script gets strategy, seo gets strategy+script', async () => {
    const step = makeStep();
    await handler({ ...makeEvent(), step });

    expect(mocks.runScriptStage).toHaveBeenCalledWith(STRATEGY);
    expect(mocks.runSEOStage).toHaveBeenCalledWith(STRATEGY, SCRIPT);
    expect(mocks.runQualityGateStage).toHaveBeenCalledWith(STRATEGY, SCRIPT, SEO);
  });

  it('inserts a scheduled calendar entry using the SEO title', async () => {
    const step = makeStep();
    await handler({ ...makeEvent(), step });

    const insert = d1.prepared.find((p) => p.method === 'run');
    expect(insert?.sql).toContain('INSERT INTO youtube_content_calendar');
    expect(insert?.sql).toContain("'scheduled'");
    const values = insert?.values ?? [];
    expect(values[1]).toBe(USER_ID);
    expect(values[2]).toBe(CONFIG_ID);
    expect(values[3]).toBe(SEO.title);
    expect(values[4]).toBe(STRATEGY.contentType);
    expect(String(values[5])).toContain('Pipeline pipe_');
  });
});

// ── Config parsing edge cases ───────────────────────────────────────────────

describe('channel config parsing', () => {
  it('falls back to empty pillars when content_pillars is malformed JSON', async () => {
    mocks.getD1Sync.mockReturnValue(makeD1Mock({ ...CONFIG_ROW, content_pillars: 'not-json' }));
    const step = makeStep();
    await handler({ ...makeEvent(), step });

    const [, config] = mocks.runStrategyStage.mock.calls[0];
    expect(config.contentPillars).toEqual([]);
  });

  it('applies numeric defaults for missing posts_per_week / buffer / autonomy', async () => {
    mocks.getD1Sync.mockReturnValue(
      makeD1Mock({
        objective: 'o',
        audience: 'a',
        content_pillars: '[]',
        cadence: 'weekly',
        posts_per_week: null,
        content_buffer_days: null,
        autonomy_level: null,
      }),
    );
    const step = makeStep();
    await handler({ ...makeEvent(), step });

    const [, config] = mocks.runStrategyStage.mock.calls[0];
    expect(config.postsPerWeek).toBe(3);
    expect(config.bufferDays).toBe(3);
    expect(config.autonomyLevel).toBe(2);
  });
});

// ── Error handling per stage ────────────────────────────────────────────────

describe('error handling', () => {
  it('throws NonRetriableError when the channel config is missing', async () => {
    mocks.getD1Sync.mockReturnValue(makeD1Mock(null));
    const step = makeStep();

    await expect(handler({ ...makeEvent(), step })).rejects.toThrow(NonRetriableError);
    await expect(handler({ ...makeEvent(), step: makeStep() })).rejects.toThrow(
      /Channel config not found/,
    );
  });

  it('wraps a load-config DB failure as NonRetriableError with the step name', async () => {
    mocks.getD1Sync.mockImplementation(() => {
      throw new Error('D1 binding missing');
    });
    const step = makeStep();

    await expect(handler({ ...makeEvent(), step })).rejects.toThrow(
      /\[load-channel-config\] D1 binding missing/,
    );
  });

  it('wraps a strategy stage failure as NonRetriableError and stops the pipeline', async () => {
    mocks.runStrategyStage.mockRejectedValue(new Error('strategy boom'));
    const step = makeStep();

    await expect(handler({ ...makeEvent(), step })).rejects.toThrow(
      /\[strategy\] strategy boom/,
    );
    expect(mocks.runScriptStage).not.toHaveBeenCalled();
    expect(mocks.runSEOStage).not.toHaveBeenCalled();
  });

  it('wraps a script stage failure as NonRetriableError', async () => {
    mocks.runScriptStage.mockRejectedValue(new Error('script boom'));
    const step = makeStep();

    await expect(handler({ ...makeEvent(), step })).rejects.toThrow(/\[script\] script boom/);
    expect(mocks.runSEOStage).not.toHaveBeenCalled();
  });

  it('wraps an seo stage failure as NonRetriableError', async () => {
    mocks.runSEOStage.mockRejectedValue(new Error('seo boom'));
    const step = makeStep();

    await expect(handler({ ...makeEvent(), step })).rejects.toThrow(/\[seo\] seo boom/);
  });

  it('wraps a thumbnail stage failure as NonRetriableError', async () => {
    mocks.runThumbnailStage.mockRejectedValue(new Error('thumb boom'));
    const step = makeStep();

    await expect(handler({ ...makeEvent(), step })).rejects.toThrow(/\[thumbnail\] thumb boom/);
  });

  it('wraps a quality-gate stage failure as NonRetriableError', async () => {
    mocks.runQualityGateStage.mockRejectedValue(new Error('gate boom'));
    const step = makeStep();

    await expect(handler({ ...makeEvent(), step })).rejects.toThrow(
      /\[quality-gate\] gate boom/,
    );
  });

  it('rethrows NonRetriableError from a stage without double-wrapping', async () => {
    mocks.runScriptStage.mockRejectedValue(new NonRetriableError('fatal upstream'));
    const step = makeStep();

    await expect(handler({ ...makeEvent(), step })).rejects.toThrow('fatal upstream');
  });

  it('stringifies non-Error rejections into the wrapped message', async () => {
    mocks.runSEOStage.mockRejectedValue('plain string failure');
    const step = makeStep();

    await expect(handler({ ...makeEvent(), step })).rejects.toThrow(
      /\[seo\] plain string failure/,
    );
  });

  it('aborts with NonRetriableError when the quality gate fails', async () => {
    mocks.runQualityGateStage.mockResolvedValue({
      passed: false,
      violations: ['Title too short', 'Script too short'],
      warnings: [],
    });
    const step = makeStep();

    await expect(handler({ ...makeEvent(), step })).rejects.toThrow(
      /Quality gate failed: Title too short; Script too short/,
    );
    // Publish must not run after a failed quality gate.
    expect(step.calls).not.toContain('publish');
    expect(d1.prepared.some((p) => p.method === 'run')).toBe(false);
  });
});

// ── Checkpoint stage ────────────────────────────────────────────────────────

describe('checkpoint stage', () => {
  it('saves completed checkpoints for strategy, script, and seo', async () => {
    const step = makeStep();
    await handler({ ...makeEvent(), step });

    expect(checkpointStore.saveGenerationCheckpoint).toHaveBeenCalledTimes(3);
    const stages = checkpointStore.saveGenerationCheckpoint.mock.calls.map((c) => c[1]);
    expect(stages).toEqual(['strategy', 'script', 'seo']);

    const [, , data] = checkpointStore.saveGenerationCheckpoint.mock.calls[0];
    expect(data.status).toBe('completed');
    expect(data.artifact).toEqual(STRATEGY);
    expect(typeof data.completedAt).toBe('string');
  });

  it('continues to publish when the checkpoint store is unavailable', async () => {
    mocks.createCheckpointStore.mockResolvedValue(null);
    const step = makeStep();
    const result = await handler({ ...makeEvent(), step });

    expect(result.success).toBe(true);
    expect(step.calls).toContain('publish');
  });

  it('uses the same jobId for all checkpoint saves and the final result', async () => {
    const step = makeStep();
    const result = await handler({ ...makeEvent(), step });

    const jobIds = checkpointStore.saveGenerationCheckpoint.mock.calls.map((c) => c[0]);
    expect(new Set(jobIds).size).toBe(1);
    expect(jobIds[0]).toBe(result.jobId);
  });
});
