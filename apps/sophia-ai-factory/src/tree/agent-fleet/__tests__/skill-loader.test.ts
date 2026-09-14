/**
 * skill-loader.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { activateSkill, _clearSkillCache } from '../skill-loader';

describe('tree/agent-fleet/skill-loader', () => {
  beforeEach(() => {
    _clearSkillCache();
  });

  it('activates a bundled skill successfully (video-gen)', async () => {
    const skill = await activateSkill('video-gen', { tenantId: 'tenant-123' });

    expect(skill.name).toBe('video-gen');
    expect(skill.frontmatter.name).toBe('video-gen');
    expect(skill.frontmatter.description).toContain('video generation');
    expect(skill.body).toContain('# Video Gen Skill');
    expect(skill.ctx.tenantId).toBe('tenant-123');
  });

  it('activates another bundled skill (affiliate-ops)', async () => {
    const skill = await activateSkill('affiliate-ops');

    expect(skill.name).toBe('affiliate-ops');
    expect(skill.frontmatter.name).toBe('affiliate-ops');
    expect(skill.body).toContain('# Affiliate Ops Skill');
  });

  it('memoizes loaded skills in memory cache', async () => {
    const first = await activateSkill('video-gen', { attempt: 1 });
    const second = await activateSkill('video-gen', { attempt: 2 });

    expect(first.frontmatter).toBe(second.frontmatter);
    expect(first.body).toBe(second.body);
    expect(second.ctx.attempt).toBe(2);
  });

  it('throws descriptive error when skill does not exist', async () => {
    await expect(activateSkill('non-existent-skill-xyz')).rejects.toThrow(
      /OpenClaw: skill 'non-existent-skill-xyz' not found/,
    );
  });
});
