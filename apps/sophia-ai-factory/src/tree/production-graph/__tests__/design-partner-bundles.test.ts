/**
 * Design Partner bundles — unit tests (Phase D, Reality Loop v1).
 *
 * Proves the 3 archetype bundles are valid DATA against the EXISTING
 * validators: every referenced template passes validateGraphDefinition,
 * every metric is a subset of the scorecard vocabulary, autonomy levels
 * use the existing 0-4 enum, and the approval policy maps onto the
 * existing publish_content gate with requiresApproval=true.
 *
 * @module tree/production-graph/__tests__/design-partner-bundles
 */

import { describe, it, expect } from 'vitest';
import { validateGraphDefinition } from '../validate';
import { GRAPH_TEMPLATES } from '../templates';
import { GRAPH_AGENT_IDS } from '@/tree/agent-protocol/graph-agents';
import {
  DESIGN_PARTNER_BUNDLES,
  SCORECARD_METRIC_NAMES,
  PUBLISH_APPROVAL_TOOL,
  validateDesignPartnerBundle,
  type DesignPartnerBundle,
} from '../design-partner-bundles';

const KNOWN_SLUGS = new Set(Object.values(GRAPH_AGENT_IDS));

describe('DESIGN_PARTNER_BUNDLES constants', () => {
  it('ships exactly three archetype bundles with unique slugs', () => {
    expect(DESIGN_PARTNER_BUNDLES).toHaveLength(3);
    const slugs = DESIGN_PARTNER_BUNDLES.map((b) => b.slug);
    expect(new Set(slugs).size).toBe(3);
  });

  it('covers the three archetypes FOUNDER / AGENCY / CREATOR once each', () => {
    const archetypes = DESIGN_PARTNER_BUNDLES.map((b) => b.archetype);
    expect(archetypes.sort()).toEqual(['AGENCY', 'CREATOR', 'FOUNDER']);
  });

  it('every bundle is bilingual-named with non-empty objective', () => {
    for (const bundle of DESIGN_PARTNER_BUNDLES) {
      expect(bundle.nameVi.length).toBeGreaterThan(0);
      expect(bundle.nameEn.length).toBeGreaterThan(0);
      expect(bundle.objective.length).toBeGreaterThan(0);
    }
  });

  it('every bundle references a template that passes the existing validator', () => {
    for (const bundle of DESIGN_PARTNER_BUNDLES) {
      const template = GRAPH_TEMPLATES.find(
        (t) => t.slug === bundle.graphTemplateSlug,
      );
      expect(template, `template ${bundle.graphTemplateSlug} must exist`).toBeDefined();
      if (!template) continue;
      const result = validateGraphDefinition(template.definition, KNOWN_SLUGS);
      expect(result.ok, `template ${template.slug} must validate`).toBe(true);
      expect(bundle.missionType).toBe(template.missionType);
    }
  });

  it('every successMetrics key is a subset of the scorecard vocabulary', () => {
    for (const bundle of DESIGN_PARTNER_BUNDLES) {
      expect(Object.keys(bundle.successMetrics).length).toBeGreaterThan(0);
      for (const metric of Object.keys(bundle.successMetrics)) {
        expect(
          SCORECARD_METRIC_NAMES.has(metric),
          `${bundle.slug}: metric ${metric} must be in scorecard`,
        ).toBe(true);
      }
    }
  });

  it('every autonomyLevel is within the existing 0-4 enum', () => {
    for (const bundle of DESIGN_PARTNER_BUNDLES) {
      expect(bundle.autonomyLevel).toBeGreaterThanOrEqual(0);
      expect(bundle.autonomyLevel).toBeLessThanOrEqual(4);
      expect(Number.isInteger(bundle.autonomyLevel)).toBe(true);
    }
  });

  it('every approvalPolicy uses the existing publish_content gate only', () => {
    for (const bundle of DESIGN_PARTNER_BUNDLES) {
      expect(bundle.approvalPolicy.tool).toBe(PUBLISH_APPROVAL_TOOL);
      expect(bundle.approvalPolicy.requiresApproval).toBe(true);
    }
  });
});

describe('validateDesignPartnerBundle', () => {
  it('accepts all three shipped bundles', () => {
    for (const bundle of DESIGN_PARTNER_BUNDLES) {
      const result = validateDesignPartnerBundle(bundle);
      expect(result.ok, `bundle ${bundle.slug} must validate`).toBe(true);
    }
  });

  it('rejects a bundle referencing an unknown template', () => {
    const bad = {
      ...DESIGN_PARTNER_BUNDLES[0]!,
      graphTemplateSlug: 'does-not-exist',
    };
    const result = validateDesignPartnerBundle(bad);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('UNKNOWN_TEMPLATE');
  });

  it('rejects an invented metric not in the scorecard', () => {
    const bad = {
      ...DESIGN_PARTNER_BUNDLES[0]!,
      successMetrics: { vibe_score: 10 },
    };
    const result = validateDesignPartnerBundle(bad);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('METRIC_NOT_IN_SCORECARD');
  });

  it('rejects an out-of-range autonomy level', () => {
    const bad = {
      ...DESIGN_PARTNER_BUNDLES[0]!,
      autonomyLevel: 9 as 0 | 1 | 2 | 3 | 4,
    };
    const result = validateDesignPartnerBundle(bad);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('BAD_AUTONOMY_LEVEL');
  });

  it('rejects an approval policy that is not the publish gate', () => {
    const bad: DesignPartnerBundle = {
      ...DESIGN_PARTNER_BUNDLES[0]!,
      approvalPolicy: { tool: 'publish_content', requiresApproval: false },
    };
    const result = validateDesignPartnerBundle(bad);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('BAD_APPROVAL_POLICY');
  });
});
