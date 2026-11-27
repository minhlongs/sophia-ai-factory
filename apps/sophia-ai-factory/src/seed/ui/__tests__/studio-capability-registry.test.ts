import { describe, expect, it } from 'vitest';
import {
  SOPHIA_STUDIO_CAPABILITIES,
  filterCapabilities,
} from '@/seed/ui/studio-capability-registry';

describe('Round 20 — Sophia UI/UX 2026 Core Kit Registry', () => {
  it('provides bilingual VI/EN copy and non-empty inspector fields for every registered engine', () => {
    expect(SOPHIA_STUDIO_CAPABILITIES.length).toBeGreaterThanOrEqual(8);
    for (const cap of SOPHIA_STUDIO_CAPABILITIES) {
      expect(cap.title.vi.trim().length).toBeGreaterThan(0);
      expect(cap.title.en.trim().length).toBeGreaterThan(0);
      expect(cap.summary.vi.trim().length).toBeGreaterThan(0);
      expect(cap.summary.en.trim().length).toBeGreaterThan(0);
      expect(cap.inspectorFields.length).toBeGreaterThan(0);
    }
  });

  it('hides R&D-only engines in default Simple Mode and reveals them in Inspector Mode', () => {
    const simple = filterCapabilities(SOPHIA_STUDIO_CAPABILITIES, { inspectorMode: false });
    const full = filterCapabilities(SOPHIA_STUDIO_CAPABILITIES, { inspectorMode: true });

    expect(simple.every((c) => c.simpleModeVisible)).toBe(true);
    expect(full.length).toBe(SOPHIA_STUDIO_CAPABILITIES.length);
    expect(full.length).toBeGreaterThan(simple.length);
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
    expect(byCategory.map((c) => c.id)).toEqual(['asn-click-fraud-shield', 'creator-va-rbac']);
  });
});
