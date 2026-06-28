import { describe, expect, it } from 'vitest';
import { evaluateSOC2Readiness, getSoc2Report } from './soc2-prep';

describe('soc2-prep', () => {
  it('evaluates all controls without async placeholders', () => {
    const result = evaluateSOC2Readiness('MASTER');

    expect(result.totalControls).toBeGreaterThan(0);
    expect(result.findings).toHaveLength(result.totalControls);
    expect(result.passed + result.failed + result.notApplicable).toBe(result.totalControls);
  });

  it('does not claim immutable audit migration is applied from runtime config alone', () => {
    const report = getSoc2Report('MASTER');

    expect(report).toContain('External evidence required: verify D1 migration 0170 admin_audit_log triggers');
    expect(report).toContain('Supabase RAAS audit immutability');
    expect(report).not.toContain('APPLIED');
  });

  it('fails controls that require external evidence even when implementation probes pass', () => {
    const result = evaluateSOC2Readiness('MASTER');
    const backup = result.findings.find((finding) => finding.controlId === 'A1.1');
    const inputValidation = result.findings.find((finding) => finding.controlId === 'PI1.1');

    expect(backup).toMatchObject({
      status: 'fail',
      note: 'External evidence required for A1.1',
      evidenceMissing: 'Recent backup artifact plus restore-drill record',
    });
    expect(inputValidation).toMatchObject({
      status: 'fail',
      note: 'External evidence required for PI1.1',
    });
  });
});
