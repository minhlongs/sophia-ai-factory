import { failure, success, type Result } from '@/seed/types/result';
import { GRAPH_TEMPLATES, type ProductionGraphTemplate } from '../templates';
import { SCORECARD_METRIC_NAMES } from './constants';
import { PUBLISH_APPROVAL_TOOL, type BundleValidationError, type DesignPartnerBundle } from './types';

/**
 * Validate a bundle against the existing template set and scorecard
 * vocabulary. Pure and deterministic. Does NOT re-run graph validation —
 * the referenced template is already validated by validateGraphDefinition
 * (see __tests__/design-partner-bundles.test.ts).
 */
export function validateDesignPartnerBundle(
  bundle: DesignPartnerBundle,
  templates: readonly ProductionGraphTemplate[] = GRAPH_TEMPLATES,
): Result<DesignPartnerBundle, BundleValidationError> {
  const template = templates.find((t) => t.slug === bundle.graphTemplateSlug);
  if (!template) {
    return failure({
      code: 'UNKNOWN_TEMPLATE',
      message: `Bundle ${bundle.slug} references unknown template ${bundle.graphTemplateSlug}`,
      slug: bundle.graphTemplateSlug,
    });
  }
  for (const metric of Object.keys(bundle.successMetrics)) {
    if (!SCORECARD_METRIC_NAMES.has(metric)) {
      return failure({
        code: 'METRIC_NOT_IN_SCORECARD',
        message: `Bundle ${bundle.slug} metric ${metric} is not in the scorecard vocabulary`,
        metric,
      });
    }
  }
  if (
    !Number.isInteger(bundle.autonomyLevel) ||
    bundle.autonomyLevel < 0 ||
    bundle.autonomyLevel > 4
  ) {
    return failure({
      code: 'BAD_AUTONOMY_LEVEL',
      message: `Bundle ${bundle.slug} autonomyLevel must be 0-4, got ${bundle.autonomyLevel}`,
      level: bundle.autonomyLevel,
    });
  }
  if (
    bundle.approvalPolicy.tool !== PUBLISH_APPROVAL_TOOL ||
    bundle.approvalPolicy.requiresApproval !== true
  ) {
    return failure({
      code: 'BAD_APPROVAL_POLICY',
      message: `Bundle ${bundle.slug} must use the existing publish_content gate`,
    });
  }
  return success(bundle);
}
