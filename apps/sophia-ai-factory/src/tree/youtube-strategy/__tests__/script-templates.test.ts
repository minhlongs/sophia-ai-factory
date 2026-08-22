import { SCRIPT_TEMPLATES, getTemplate, requiredSections, allSections, type ScriptFormat } from '../script-templates';

describe('script-templates', () => {
  it('has all 5 format templates', () => {
    const formats: ScriptFormat[] = ['tutorial', 'explainer', 'list', 'review', 'story'];
    for (const f of formats) {
      expect(SCRIPT_TEMPLATES[f]).toBeDefined();
    }
  });

  it('tutorial has educational tone and moderate pacing', () => {
    expect(SCRIPT_TEMPLATES.tutorial.tone).toBe('educational');
    expect(SCRIPT_TEMPLATES.tutorial.pacing).toBe('moderate');
  });

  it('explainer has informative tone and steady pacing', () => {
    expect(SCRIPT_TEMPLATES.explainer.tone).toBe('informative');
    expect(SCRIPT_TEMPLATES.explainer.pacing).toBe('steady');
  });

  it('list has engaging tone and quick pacing', () => {
    expect(SCRIPT_TEMPLATES.list.tone).toBe('engaging');
    expect(SCRIPT_TEMPLATES.list.pacing).toBe('quick');
  });

  it('review has analytical tone and detailed pacing', () => {
    expect(SCRIPT_TEMPLATES.review.tone).toBe('analytical');
    expect(SCRIPT_TEMPLATES.review.pacing).toBe('detailed');
  });

  it('story has narrative tone and dynamic pacing', () => {
    expect(SCRIPT_TEMPLATES.story.tone).toBe('narrative');
    expect(SCRIPT_TEMPLATES.story.pacing).toBe('dynamic');
  });

  it('getTemplate returns explainer for unknown format', () => {
    const template = getTemplate('unknown');
    expect(template.tone).toBe('informative');
  });

  it('getTemplate is case-insensitive', () => {
    const template = getTemplate('TUTORIAL');
    expect(template.tone).toBe('educational');
  });

  it('requiredSections returns only required sections', () => {
    const sections = requiredSections('tutorial');
    expect(sections).toContain('hook');
    expect(sections).toContain('introduction');
    expect(sections).toContain('cta');
    expect(sections).not.toContain('demonstration');
  });

  it('allSections returns all sections including optional', () => {
    const sections = allSections('tutorial');
    expect(sections).toContain('hook');
    expect(sections).toContain('demonstration');
  });

  it('tutorial requires hook, introduction, and cta', () => {
    const sections = requiredSections('tutorial');
    expect(sections).toEqual(['hook', 'introduction', 'problem', 'solution_steps', 'cta']);
  });

  it('story has journey, climax, resolution sections', () => {
    const sections = allSections('story');
    expect(sections).toContain('journey');
    expect(sections).toContain('climax');
    expect(sections).toContain('resolution');
  });
});