import type { Tier } from '@/seed/types';
import { evaluateSOC2Readiness } from './evidence-builder';
import type { SOC2Finding, SOC2ReadinessResult } from './types';

export function getSoc2Report(tier: Tier): string {
  const result = evaluateSOC2Readiness(tier);
  const lines: string[] = [
    'SOC 2 Type I Readiness Report',
    `Tier: ${tier}`,
    `Timestamp: ${result.timestamp}`,
    'External evidence required: verify D1 migration 0170 admin_audit_log triggers and Supabase RAAS audit immutability before claiming CC6.6 auditor-ready.',
    '',
    `Score: ${result.score}% (${result.passed}/${result.passed + result.failed} applicable controls passing)`,
    '',
    'Findings:',
  ];

  for (const f of result.findings) {
    const icon =
      f.status === 'pass' ? '✅' : f.status === 'fail' ? '❌' : '➖';
    const detail = f.evidenceMissing ? ` — MISSING: ${f.evidenceMissing}` : '';
    lines.push(`  ${icon} [${f.controlId}] ${f.title} (${f.category})${detail}`);
  }

  if (result.recommendation) {
    lines.push('');
    lines.push(`Recommendation: ${result.recommendation}`);
  }

  return lines.join('\n');
}
