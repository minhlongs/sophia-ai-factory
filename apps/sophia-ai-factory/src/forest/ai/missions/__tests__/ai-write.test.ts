import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/seed/ai/script-generator', () => ({
  generateScript: vi.fn(async () => ({
    title: 'RaaS Automation',
    scenes: [
      { narration: 'Scene one narration', duration: 10 },
      { narration: 'Scene two narration', duration: 12 },
    ],
    total_duration: 22,
  })),
}));

vi.mock('@/tree/byok/user-api-key-store', () => ({
  lookupUserApiKey: vi.fn(),
}));

import { generateScript } from '@/seed/ai/script-generator';
import {
  ProviderInvalidKeyError,
  ProviderQuotaExceededError,
} from '@/seed/services/errors';
import { lookupUserApiKey } from '@/tree/byok/user-api-key-store';
import { handle } from '../ai-write';

describe('ai:write handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates SOP-ready video script output using explicit customer BYOK funding', async () => {
    vi.mocked(lookupUserApiKey).mockResolvedValue({
      status: 'FOUND',
      key: '  sk-or-customer-123  ',
    });

    const result = await handle({
      missionId: 'm-1',
      userId: 'u-1',
      orgId: 'org-verified-1',
      command: 'ai:write',
      params: {
        task: 'video_script',
        topic: 'RaaS video production',
        tone: 'professional',
        language: 'en',
      },
    });

    expect(result.ok).toBe(true);
    expect(lookupUserApiKey).toHaveBeenCalledWith('u-1', 'openrouter');
    expect(generateScript).toHaveBeenCalledWith(
      {
        topic: 'RaaS video production',
        audience: 'RaaS operators and non-technical founders',
        tier: 'BASIC',
        userId: 'u-1',
        orgId: 'org-verified-1',
      },
      { funding: { fund: 'byok', apiKey: 'sk-or-customer-123' } },
    );
    expect(result.data?.script).toContain('Scene one narration');
    expect(result.data?.videoScript).toBe(result.data?.script);
    expect(result.data?.caption).toContain('RaaS video production');
    expect(result.data?.hashtags).toEqual(['#raasvideoproduction', '#aiVideo', '#automation']);
  });

  it('fails closed when userId is missing', async () => {
    const result = await handle({
      missionId: 'm-2',
      userId: '',
      command: 'ai:write',
      params: { task: 'video_script', topic: 'RaaS' },
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('MISSING_USER');
    expect(generateScript).not.toHaveBeenCalled();
  });

  it('fails closed with MISSING_ORG_CONTEXT when verified ctx.orgId is missing (no userId fallback)', async () => {
    vi.mocked(lookupUserApiKey).mockResolvedValue({ status: 'FOUND', key: 'sk-or-customer-123' });

    const result = await handle({
      missionId: 'm-org-missing',
      userId: 'u-1',
      command: 'ai:write',
      params: { task: 'video_script', topic: 'RaaS' },
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('MISSING_ORG_CONTEXT');
    expect(generateScript).not.toHaveBeenCalled();
  });

  it('fails closed with UNAUTHORIZED_ORG when caller params.orgId does not match verified ctx.orgId', async () => {
    vi.mocked(lookupUserApiKey).mockResolvedValue({ status: 'FOUND', key: 'sk-or-customer-123' });

    const result = await handle({
      missionId: 'm-org-spoof',
      userId: 'u-1',
      orgId: 'org-verified-1',
      command: 'ai:write',
      params: { task: 'video_script', topic: 'RaaS', orgId: 'org-victim-2' },
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('UNAUTHORIZED_ORG');
    expect(generateScript).not.toHaveBeenCalled();
  });

  it('fails closed with MISSING_CREDENTIALS when customer OpenRouter key is not configured', async () => {
    vi.mocked(lookupUserApiKey).mockResolvedValue({ status: 'NOT_CONFIGURED' });

    const result = await handle({
      missionId: 'm-3',
      userId: 'u-1',
      orgId: 'org-verified-1',
      command: 'ai:write',
      params: { task: 'video_script', topic: 'RaaS' },
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('MISSING_CREDENTIALS');
    expect(generateScript).not.toHaveBeenCalled();
  });

  it('fails closed with CREDENTIAL_READ_ERROR when customer key cannot be decrypted', async () => {
    vi.mocked(lookupUserApiKey).mockResolvedValue({ status: 'DECRYPT_FAILED' });

    const result = await handle({
      missionId: 'm-4',
      userId: 'u-1',
      orgId: 'org-verified-1',
      command: 'ai:write',
      params: { task: 'video_script', topic: 'RaaS' },
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('CREDENTIAL_READ_ERROR');
    expect(generateScript).not.toHaveBeenCalled();
  });

  it('maps ProviderInvalidKeyError to PROVIDER_INVALID_KEY', async () => {
    vi.mocked(lookupUserApiKey).mockResolvedValue({ status: 'FOUND', key: 'sk-or-bad' });
    vi.mocked(generateScript).mockRejectedValueOnce(
      new ProviderInvalidKeyError('openrouter', '401 Unauthorized'),
    );

    const result = await handle({
      missionId: 'm-5',
      userId: 'u-1',
      orgId: 'org-verified-1',
      command: 'ai:write',
      params: { task: 'video_script', topic: 'RaaS' },
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('PROVIDER_INVALID_KEY');
  });

  it('maps ProviderQuotaExceededError to PROVIDER_QUOTA_EXCEEDED', async () => {
    vi.mocked(lookupUserApiKey).mockResolvedValue({ status: 'FOUND', key: 'sk-or-empty' });
    vi.mocked(generateScript).mockRejectedValueOnce(
      new ProviderQuotaExceededError('openrouter', '402 Payment Required'),
    );

    const result = await handle({
      missionId: 'm-6',
      userId: 'u-1',
      orgId: 'org-verified-1',
      command: 'ai:write',
      params: { task: 'video_script', topic: 'RaaS' },
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('PROVIDER_QUOTA_EXCEEDED');
  });
});
