/**
 * LLM Router Tests
 * Validates priority: local_llm → deepseek → anthropic → throw
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveLlmRoute } from './llm-router';

vi.mock('@/lib/credentials/user-credentials-repo', () => ({
  getUserCredential: vi.fn(),
}));

import { getUserCredential } from '@/lib/credentials/user-credentials-repo';
const mockGetCred = vi.mocked(getUserCredential);

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

  it('returns local route when local_llm cred exists', async () => {
    const credValue = JSON.stringify({ url: 'http://localhost:11434/v1', apiKey: 'my-key', model: 'llama3' });
    mockGetCred.mockResolvedValueOnce(credValue);

    const route = await resolveLlmRoute('user-1');
    expect(route.provider).toBe('local');
    expect(route.baseUrl).toBe('http://localhost:11434/v1');
    expect(route.apiKey).toBe('my-key');
    expect(route.model).toBe('llama3');
  });

  it('falls back to deepseek if local_llm not set', async () => {
    mockGetCred.mockResolvedValueOnce(null);
    process.env.DEEPSEEK_API_KEY = 'ds-key-123';

    const route = await resolveLlmRoute('user-1');
    expect(route.provider).toBe('deepseek');
    expect(route.model).toBe('deepseek-reasoner');
    expect(route.apiKey).toBe('ds-key-123');
  });

  it('falls back to anthropic if deepseek not set', async () => {
    mockGetCred.mockResolvedValueOnce(null);
    process.env.ANTHROPIC_API_KEY = 'ant-key-456';

    const route = await resolveLlmRoute('user-1');
    expect(route.provider).toBe('anthropic');
    expect(route.model).toBe('claude-3-5-sonnet-20241022');
  });

  it('throws NO_LLM_CONFIGURED when no provider available', async () => {
    mockGetCred.mockResolvedValueOnce(null);

    await expect(resolveLlmRoute('user-1')).rejects.toThrow('NO_LLM_CONFIGURED');
  });

  it('falls through malformed local_llm JSON to next provider', async () => {
    mockGetCred.mockResolvedValueOnce('not-json');
    process.env.DEEPSEEK_API_KEY = 'ds-key';

    const route = await resolveLlmRoute('user-1');
    expect(route.provider).toBe('deepseek');
  });

  it('falls through local_llm with no url to next provider', async () => {
    mockGetCred.mockResolvedValueOnce(JSON.stringify({ apiKey: 'x' }));
    process.env.DEEPSEEK_API_KEY = 'ds-key';

    const route = await resolveLlmRoute('user-1');
    expect(route.provider).toBe('deepseek');
  });

  it('local route strips trailing slash from url', async () => {
    mockGetCred.mockResolvedValueOnce(JSON.stringify({ url: 'http://host:11434/' }));

    const route = await resolveLlmRoute('user-1');
    expect(route.baseUrl).toBe('http://host:11434');
  });
});
