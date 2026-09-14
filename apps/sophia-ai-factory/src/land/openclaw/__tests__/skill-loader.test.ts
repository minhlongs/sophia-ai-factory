/**
 * skill-loader.test.ts (land/openclaw)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { activateSkill, _clearSkillCache } from '../skill-loader';

describe('land/openclaw/skill-loader', () => {
  beforeEach(() => {
    _clearSkillCache();
  });

  it('activates bundled video-gen skill in land/openclaw', async () => {
    const skill = await activateSkill('video-gen', { tenantId: 'tenant-land-1' });

    expect(skill.name).toBe('video-gen');
    expect(skill.frontmatter.name).toBe('video-gen');
    expect(skill.frontmatter.description).toContain('video generation');
    expect(skill.body).toContain('# Video Gen Skill');
    expect(skill.ctx.tenantId).toBe('tenant-land-1');
  });

  it('memoizes loaded skills in memory cache', async () => {
    const first = await activateSkill('social-publishing');
    const second = await activateSkill('social-publishing');

    expect(first.frontmatter).toBe(second.frontmatter);
    expect(first.body).toBe(second.body);
  });

  it('throws descriptive error when skill does not exist', async () => {
    await expect(activateSkill('missing-skill-123')).rejects.toThrow(
      /OpenClaw: skill 'missing-skill-123' not found/,
    );
  });
});
