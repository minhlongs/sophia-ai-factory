import { describe, it, expect } from 'vitest';
import {
  calculateDeliberationComposite,
  determineDeliberationVerdict,
  aggregateDeliberationReport,
} from '../deliberation-consensus';
import { LensEvaluation } from '@/seed/types/growth-triad-v13';

describe('Creative Deliberation Consensus Engine', () => {
  it('correctly weights composite scores across 3 lenses', () => {
    const evaluations: LensEvaluation[] = [
      { lens: 'HOOK_ANALYST', score: 80, feedback: 'Strong hook' },
      { lens: 'RETENTION_CRITIC', score: 90, feedback: 'Great pacing' },
      { lens: 'COMPLIANCE_GUARD', score: 100, feedback: 'Fully safe' },
    ];
    // 80*0.4 + 90*0.35 + 100*0.25 = 32 + 31.5 + 25 = 88.5
    const composite = calculateDeliberationComposite(evaluations);
    expect(composite).toBe(88.5);
  });

  it('rejects if compliance guard score drops below hard floor', () => {
    const evaluations: LensEvaluation[] = [
      { lens: 'HOOK_ANALYST', score: 95, feedback: 'Viral' },
      { lens: 'RETENTION_CRITIC', score: 95, feedback: 'Engaging' },
      { lens: 'COMPLIANCE_GUARD', score: 65, feedback: 'Trademark hazard' },
    ];
    const composite = calculateDeliberationComposite(evaluations);
    const verdict = determineDeliberationVerdict(composite, evaluations);
    expect(verdict).toBe('REJECTED');
  });

  it('returns REVISE if composite is between 60 and 75 with good compliance', () => {
    const evaluations: LensEvaluation[] = [
      { lens: 'HOOK_ANALYST', score: 65, feedback: 'Average hook' },
      { lens: 'RETENTION_CRITIC', score: 65, feedback: 'Slightly slow' },
      { lens: 'COMPLIANCE_GUARD', score: 80, feedback: 'Clean' },
    ];
    const composite = calculateDeliberationComposite(evaluations);
    const verdict = determineDeliberationVerdict(composite, evaluations);
    expect(verdict).toBe('REVISE');
  });

  it('aggregates full deliberation report', () => {
    const evaluations: [LensEvaluation, LensEvaluation, LensEvaluation] = [
      { lens: 'HOOK_ANALYST', score: 85, feedback: 'Good hook' },
      { lens: 'RETENTION_CRITIC', score: 80, feedback: 'Steady' },
      { lens: 'COMPLIANCE_GUARD', score: 90, feedback: 'Safe' },
    ];
    const report = aggregateDeliberationReport(
      'script-1',
      'user-1',
      'Original script full content here for video production',
      evaluations
    );
    expect(report.verdict).toBe('APPROVED');
    expect(report.compositeScore).toBeGreaterThanOrEqual(75);
    expect(report.evaluations).toHaveLength(3);
  });
});
