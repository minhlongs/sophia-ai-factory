import { describe, expect, it, vi } from 'vitest';

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

import { generateScript } from '@/seed/ai/script-generator';
import { handle } from './ai-write';

describe('ai:write handler', () => {
  it('generates SOP-ready video script output', async () => {
    const result = await handle({
      missionId: 'm-1',
      userId: 'u-1',
      command: 'ai:write',
      params: {
        task: 'video_script',
        topic: 'RaaS video production',
        tone: 'professional',
        language: 'en',
      },
    });

    expect(result.ok).toBe(true);
    expect(generateScript).toHaveBeenCalledWith({
      topic: 'RaaS video production',
      audience: 'RaaS operators and non-technical founders',
      tier: 'BASIC',
      userId: 'u-1',
      orgId: 'u-1',
    });
    expect(result.data?.script).toContain('Scene one narration');
    expect(result.data?.videoScript).toBe(result.data?.script);
    expect(result.data?.caption).toContain('RaaS video production');
    expect(result.data?.hashtags).toEqual(['#raasvideoproduction', '#aiVideo', '#automation']);
  });
});
