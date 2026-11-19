import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { NonRetriableError } from 'inngest';

const mocks = vi.hoisted(() => ({
  dbFrom: vi.fn(),
  lookupUserApiKey: vi.fn(),
  resilientChatCompletion: vi.fn(),
  recordCost: vi.fn(),
  inngestSend: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  createServerClient: () => ({ from: mocks.dbFrom }),
}));

vi.mock('@/tree/byok/user-api-key-store', () => ({
  lookupUserApiKey: mocks.lookupUserApiKey,
}));

vi.mock('@/seed/inference/openrouter-client', () => ({
  resilientChatCompletion: mocks.resilientChatCompletion,
}));

vi.mock('@/land/video/templates/cost-ledger', () => ({
  recordCost: mocks.recordCost,
}));

vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    send: mocks.inngestSend,
    createFunction: (_cfg: unknown, _trigger: unknown, fn: (...args: unknown[]) => unknown) => ({
      fn,
    }),
  },
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: mocks.loggerInfo,
    warn: mocks.loggerWarn,
    error: mocks.loggerError,
    debug: vi.fn(),
  },
}));

import {
  ProviderInvalidKeyError,
  ProviderQuotaExceededError,
} from '@/seed/services/errors';
import { videoScripting } from './video-scripting';

type VideoScriptingStep = {
  run: (id: string, fn: () => Promise<unknown>) => Promise<unknown>;
  sendEvent: (id: string, payload: unknown) => Promise<void>;
};

type VideoScriptingHandler = (ctx: {
  event: { data: { jobId: string; tenantId: string; userId: string } };
  step: VideoScriptingStep;
}) => Promise<unknown>;

function makeStep(): VideoScriptingStep {
  return {
    run: vi.fn(async (_id: string, fn: () => Promise<unknown>) => fn()),
    sendEvent: vi.fn(async () => undefined),
  };
}

function makeDbChain(singleResult: unknown) {
  const updateCalls: Array<Record<string, unknown>> = [];
  const chain = {
    select: vi.fn(() => chain),
    update: vi.fn((payload: Record<string, unknown>) => {
      updateCalls.push(payload);
      return chain;
    }),
    eq: vi.fn(() => chain),
    single: vi.fn(async () => ({ data: singleResult, error: null })),
    then: vi.fn((resolve: (v: unknown) => void) => resolve({ data: null, error: null })),
  };
  return { chain, updateCalls };
}

describe('G3: videoScripting customer BYOK enforcement', () => {
  const originalPlatformKey = process.env.OPENROUTER_API_KEY;
  const runHandler = (videoScripting as unknown as { fn: VideoScriptingHandler }).fn;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENROUTER_API_KEY = 'sk-or-platform-secret-MUST-NEVER-BE-USED';
  });

  afterEach(() => {
    if (originalPlatformKey === undefined) {
      delete process.env.OPENROUTER_API_KEY;
    } else {
      process.env.OPENROUTER_API_KEY = originalPlatformKey;
    }
  });

  it('uses ONLY the verified customer BYOK OpenRouter key and ignores platform env OPENROUTER_API_KEY', async () => {
    const { chain, updateCalls } = makeDbChain({
      status: 'queued',
      prompt: 'Launch faceless finance video',
      tenant_id: 'org-customer-1',
      user_id: 'user-customer-1',
    });
    mocks.dbFrom.mockReturnValue(chain);
    mocks.lookupUserApiKey.mockResolvedValue({
      status: 'FOUND',
      key: '  sk-or-customer-byok-key  ',
    });
    mocks.resilientChatCompletion.mockResolvedValue('Scene 1: Customer script');

    const step = makeStep();
    const res = await runHandler({
      event: { data: { jobId: 'job-1', tenantId: 'org-customer-1', userId: 'user-customer-1' } },
      step,
    });

    expect(res).toEqual({ jobId: 'job-1', status: 'scripting' });
    expect(mocks.lookupUserApiKey).toHaveBeenCalledWith('user-customer-1', 'openrouter');
    expect(mocks.resilientChatCompletion).toHaveBeenCalledWith(
      'Write a video script for: Launch faceless finance video',
      expect.objectContaining({
        openRouterKey: 'sk-or-customer-byok-key',
        anthropicKey: undefined,
        enableFallback: false,
      }),
    );
    expect(updateCalls.some((u) => u.script_text === 'Scene 1: Customer script')).toBe(true);
  });

  it('fails closed with NonRetriableError and marks job failed when customer BYOK key is missing', async () => {
    const { chain, updateCalls } = makeDbChain({
      status: 'queued',
      prompt: 'Missing key test',
      tenant_id: 'org-customer-1',
      user_id: 'user-customer-1',
    });
    mocks.dbFrom.mockReturnValue(chain);
    mocks.lookupUserApiKey.mockResolvedValue({ status: 'NOT_CONFIGURED' });

    const step = makeStep();
    await expect(
      runHandler({
        event: { data: { jobId: 'job-2', tenantId: 'org-customer-1', userId: 'user-customer-1' } },
        step,
      }),
    ).rejects.toThrow(NonRetriableError);

    expect(mocks.resilientChatCompletion).not.toHaveBeenCalled();
    expect(updateCalls.some((u) => u.status === 'failed')).toBe(true);
  });

  it('fails closed cleanly without leaking customer key on ProviderInvalidKeyError or ProviderQuotaExceededError', async () => {
    const { chain, updateCalls } = makeDbChain({
      status: 'queued',
      prompt: 'Invalid key test',
      tenant_id: 'org-customer-1',
      user_id: 'user-customer-1',
    });
    mocks.dbFrom.mockReturnValue(chain);
    mocks.lookupUserApiKey.mockResolvedValue({ status: 'FOUND', key: 'sk-or-secret-customer-xyz' });
    mocks.resilientChatCompletion.mockRejectedValueOnce(new ProviderInvalidKeyError('openrouter', '401 Unauthorized'));

    const step = makeStep();
    await expect(
      runHandler({
        event: { data: { jobId: 'job-3', tenantId: 'org-customer-1', userId: 'user-customer-1' } },
        step,
      }),
    ).rejects.toThrow(NonRetriableError);

    const failedUpdate = updateCalls.find((u) => u.status === 'failed');
    expect(failedUpdate).toBeDefined();
    expect(String(failedUpdate?.error_message)).not.toContain('sk-or-secret-customer-xyz');

    mocks.resilientChatCompletion.mockRejectedValueOnce(new ProviderQuotaExceededError('openrouter', '402 Payment Required'));
    await expect(
      runHandler({
        event: { data: { jobId: 'job-3', tenantId: 'org-customer-1', userId: 'user-customer-1' } },
        step,
      }),
    ).rejects.toThrow(NonRetriableError);
  });

  it('rejects cross-tenant / user ownership mismatch before loading any credentials', async () => {
    const { chain } = makeDbChain({
      status: 'queued',
      prompt: 'Cross tenant attempt',
      tenant_id: 'org-victim',
      user_id: 'user-victim',
    });
    mocks.dbFrom.mockReturnValue(chain);

    const step = makeStep();
    await expect(
      runHandler({
        event: { data: { jobId: 'job-4', tenantId: 'org-victim', userId: 'user-attacker' } },
        step,
      }),
    ).rejects.toThrow(NonRetriableError);

    expect(mocks.lookupUserApiKey).not.toHaveBeenCalled();
    expect(mocks.resilientChatCompletion).not.toHaveBeenCalled();
  });
});
