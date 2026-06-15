/**
 * LLM Router Tests
 * Validates priority: deepseek → anthropic → throw
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveLlmRoute } from './llm-router';

vi.mock('@/tree/credentials/user-credentials-repo', () => ({
  getUserCredential: vi.fn(),
}));

describe('resolveLlmRoute', () => {
  const ORIG_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIG_ENV };
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    vi.resetAllMocks();
  });

  afterEach(() => {
    process.env = ORIG_ENV;
  });

  it('resolves to deepseek when DEEPSEEK_API_KEY exists', async () => {
    process.env.DEEPSEEK_API_KEY = 'ds-key-123';

    const route = await resolveLlmRoute('user-1');
    expect(route.provider).toBe('deepseek');
    expect(route.model).toBe('deepseek-reasoner');
    expect(route.apiKey).toBe('ds-key-123');
  });

  it('falls back to anthropic if deepseek not set', async () => {
    process.env.ANTHROPIC_API_KEY = 'ant-key-456';

    const route = await resolveLlmRoute('user-1');
    expect(route.provider).toBe('anthropic');
    expect(route.model).toBe('claude-3-5-sonnet-20241022');
    expect(route.apiKey).toBe('ant-key-456');
  });

  it('throws NO_LLM_CONFIGURED when no provider available', async () => {
    await expect(resolveLlmRoute('user-1')).rejects.toThrow('NO_LLM_CONFIGURED');
  });
});
