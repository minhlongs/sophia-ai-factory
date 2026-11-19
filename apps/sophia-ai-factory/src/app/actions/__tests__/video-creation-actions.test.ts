import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/seed/db/resolve-user-tier', () => ({
  resolveUserTier: vi.fn(),
}));

vi.mock('@/seed/auth/workspace-access', () => ({
  resolveOrgId: vi.fn(),
}));

vi.mock('@/land/services/factory', () => ({
  ServiceFactory: {
    getScriptService: vi.fn(),
  },
}));

vi.mock('@/land/campaigns', () => ({
  insertCampaignRecord: vi.fn(),
  sendCampaignCreatedEvent: vi.fn(),
}));

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { resolveOrgId } from '@/seed/auth/workspace-access';
import { ServiceFactory } from '@/land/services/factory';
import {
  MissingCredentialsError,
  ProviderInvalidKeyError,
  ProviderNetworkError,
  ProviderQuotaExceededError,
} from '@/seed/services/errors';
import { generateVideoScriptAction } from '../video-creation-actions';

describe('generateVideoScriptAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveUserTier).mockResolvedValue('PREMIUM');
    vi.mocked(resolveOrgId).mockResolvedValue('org-1');
  });

  it('fails closed with AUTH_REQUIRED when caller is unauthenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const result = await generateVideoScriptAction('Launch offer');

    expect(result).toEqual({
      success: false,
      error: 'Authentication required',
      code: 'AUTH_REQUIRED',
    });
    expect(ServiceFactory.getScriptService).not.toHaveBeenCalled();
  });

  it('fails closed with BYOK_KEY_REQUIRED when customer has no OpenRouter key', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: 'user-1',
      email: 'founder@example.com',
      role: 'user',
    } as never);
    vi.mocked(ServiceFactory.getScriptService).mockRejectedValue(
      new MissingCredentialsError('OPENROUTER_API_KEY'),
    );

    const result = await generateVideoScriptAction('Launch offer');

    expect(result.success).toBe(false);
    expect(result.code).toBe('BYOK_KEY_REQUIRED');
    expect(ServiceFactory.getScriptService).toHaveBeenCalledWith('user-1');
  });

  it('fails closed with BYOK_KEY_UNAVAILABLE when customer key cannot be read', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: 'user-1',
      email: 'founder@example.com',
      role: 'user',
    } as never);
    vi.mocked(ServiceFactory.getScriptService).mockRejectedValue(
      new ProviderNetworkError('openrouter', 'Customer credential could not be read'),
    );

    const result = await generateVideoScriptAction('Launch offer');

    expect(result.success).toBe(false);
    expect(result.code).toBe('BYOK_KEY_UNAVAILABLE');
  });

  it('fails closed with BYOK_KEY_INVALID when OpenRouter rejects the customer key', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: 'user-1',
      email: 'founder@example.com',
      role: 'user',
    } as never);
    vi.mocked(ServiceFactory.getScriptService).mockResolvedValue({
      generateScript: vi.fn().mockRejectedValue(
        new ProviderInvalidKeyError('openrouter', '401 Unauthorized'),
      ),
    });

    const result = await generateVideoScriptAction('Launch offer');

    expect(result.success).toBe(false);
    expect(result.code).toBe('BYOK_KEY_INVALID');
  });

  it('fails closed with BYOK_QUOTA_EXCEEDED when customer OpenRouter quota is exhausted', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: 'user-1',
      email: 'founder@example.com',
      role: 'user',
    } as never);
    vi.mocked(ServiceFactory.getScriptService).mockResolvedValue({
      generateScript: vi.fn().mockRejectedValue(
        new ProviderQuotaExceededError('openrouter', '402 Payment Required'),
      ),
    });

    const result = await generateVideoScriptAction('Launch offer');

    expect(result.success).toBe(false);
    expect(result.code).toBe('BYOK_QUOTA_EXCEEDED');
  });

  it('generates script via ServiceFactory customer BYOK service and formats lines', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: 'user-1',
      email: 'founder@example.com',
      role: 'user',
    } as never);
    const mockGenerate = vi.fn().mockResolvedValue({
      title: 'Scale Revenue Fast',
      scenes: [
        { scene_number: 1, visual_description: 'Hook', narration: 'Stop burning ad spend.', duration_estimate: 5 },
        { scene_number: 2, visual_description: 'Body', narration: 'Automate your pipeline.', duration_estimate: 10 },
      ],
      total_duration: 15,
    });
    vi.mocked(ServiceFactory.getScriptService).mockResolvedValue({
      generateScript: mockGenerate,
    });

    const result = await generateVideoScriptAction('  Scale Revenue  ');

    expect(ServiceFactory.getScriptService).toHaveBeenCalledWith('user-1');
    expect(mockGenerate).toHaveBeenCalledWith({
      topic: 'Scale Revenue',
      audience: 'Entrepreneurs & Creators',
      tier: 'PREMIUM',
      userId: 'user-1',
      orgId: 'org-1',
    });
    expect(result).toEqual({
      success: true,
      scriptText: 'Scale Revenue Fast\n\nStop burning ad spend.\n\nAutomate your pipeline.',
    });
  });
});
