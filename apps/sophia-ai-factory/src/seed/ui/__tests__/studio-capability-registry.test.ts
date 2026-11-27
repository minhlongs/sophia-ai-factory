import { describe, expect, it } from 'vitest';
import {
  SOPHIA_STUDIO_CAPABILITIES,
  filterCapabilities,
} from '@/seed/ui/studio-capability-registry';

describe('Round 20+ — Full BE-to-FE Registry Coverage (Rounds 1–19)', () => {
  it('registers all 34 live engines from Rounds 1-35 with unique IDs and bilingual VI/EN copy', () => {
    expect(SOPHIA_STUDIO_CAPABILITIES.length).toBe(34);
    const ids = new Set(SOPHIA_STUDIO_CAPABILITIES.map((c) => c.id));
    expect(ids.size).toBe(34);

    for (const cap of SOPHIA_STUDIO_CAPABILITIES) {
      expect(cap.title.vi.trim().length).toBeGreaterThan(0);
      expect(cap.title.en.trim().length).toBeGreaterThan(0);
      expect(cap.summary.vi.trim().length).toBeGreaterThan(0);
      expect(cap.summary.en.trim().length).toBeGreaterThan(0);
      expect(cap.inspectorFields.length).toBeGreaterThan(0);
    }
  });

  it('shows 4 core tiles in Simple Mode and reveals all 19 engines in R&D Inspector Mode', () => {
    const simple = filterCapabilities(SOPHIA_STUDIO_CAPABILITIES, { inspectorMode: false });
    const full = filterCapabilities(SOPHIA_STUDIO_CAPABILITIES, { inspectorMode: true });

    expect(simple.length).toBe(4);
    expect(simple.every((c) => c.simpleModeVisible)).toBe(true);
    expect(full.length).toBe(34);
  });

  it('filters by bilingual keyword and category accurately', () => {
    const byViKeyword = filterCapabilities(SOPHIA_STUDIO_CAPABILITIES, {
      query: 'phân quyền',
      inspectorMode: true,
    });
    expect(byViKeyword.map((c) => c.id)).toEqual(['creator-va-rbac']);

    const byCategory = filterCapabilities(SOPHIA_STUDIO_CAPABILITIES, {
      category: 'security',
      inspectorMode: true,
    });
    expect(byCategory.length).toBe(6);
  });
});
