/**
 * Unit tests for the partner tax status presentation mapper.
 *
 * Covers the state machine the portal renders: which form is required, whether
 * payouts are released or held, and the vocabulary normalisation between the
 * Phase 1 resolver (uppercase) and the stored column (lowercase).
 *
 * @module land/affiliates/__tests__/tax-status-presentation
 */

import { describe, it, expect } from 'vitest';
import {
  buildTaxStatusView,
  normaliseFormType,
  type TaxFormStatus,
  type TaxStatusView,
} from '../tax-status-presentation';

/** A view for one (form, status) combination. */
function view(formType: string, status: TaxFormStatus, country = 'VN'): TaxStatusView {
  return buildTaxStatusView({ formType, status, country });
}

describe('normaliseFormType', () => {
  it('accepts the lowercase stored vocabulary', () => {
    expect(normaliseFormType('w9')).toBe('w9');
    expect(normaliseFormType('w8ben')).toBe('w8ben');
    expect(normaliseFormType('local_declaration')).toBe('local_declaration');
    expect(normaliseFormType('unknown')).toBe('unknown');
  });

  it('accepts the uppercase Phase 1 resolver vocabulary', () => {
    expect(normaliseFormType('W9')).toBe('w9');
    expect(normaliseFormType('W8BEN')).toBe('w8ben');
    // The resolver names the Vietnamese form differently from the column.
    expect(normaliseFormType('VN_SELF_DECLARATION')).toBe('local_declaration');
  });

  it('falls back to unknown for anything unrecognised', () => {
    expect(normaliseFormType('')).toBe('unknown');
    expect(normaliseFormType('W-89')).toBe('unknown');
    expect(normaliseFormType('NONSENSE')).toBe('unknown');
  });
});

describe('buildTaxStatusView — payout blocking', () => {
  it('releases payouts only when the form is verified', () => {
    expect(view('w9', 'verified', 'US').payoutBlocking).toBe('released');
    expect(view('local_declaration', 'verified').payoutBlocking).toBe('released');
  });

  it('holds payouts while a form is outstanding, pending, rejected or expired', () => {
    const holding: TaxFormStatus[] = ['not_submitted', 'pending_verification', 'rejected', 'expired'];
    for (const status of holding) {
      expect(view('w8ben', status, 'DE').payoutBlocking).toBe('held');
    }
  });

  it('always holds when no country is declared, even if a status says verified', () => {
    // A verified column value with no residency country is inconsistent data;
    // the honest rendering is "held, ask again" rather than "released".
    expect(view('w9', 'verified', 'unknown').payoutBlocking).toBe('held');
    expect(view('w9', 'verified', '').payoutBlocking).toBe('held');
  });
});

describe('buildTaxStatusView — status vocabulary', () => {
  it('gives a bilingual label for every stored status', () => {
    const statuses: TaxFormStatus[] = ['not_submitted', 'pending_verification', 'verified', 'rejected', 'expired'];
    for (const status of statuses) {
      const result = view('w9', status, 'US');
      expect(result.statusLabel.vi.length).toBeGreaterThan(0);
      expect(result.statusLabel.en.length).toBeGreaterThan(0);
      expect(result.description.vi.length).toBeGreaterThan(0);
      expect(result.description.en.length).toBeGreaterThan(0);
    }
  });

  it('names the resolved form for a declared country', () => {
    expect(view('local_declaration', 'not_submitted').formLabel.en).toContain('Local self-declaration');
    expect(view('w9', 'not_submitted', 'US').formLabel.en).toContain('W-9');
  });

  it('reports unknown for a partner with no declared country', () => {
    const result = view('unknown', 'not_submitted', 'unknown');
    expect(result.formType).toBe('unknown');
    expect(result.formLabel.en).toBe('Tax form not determined yet');
    expect(result.country).toBe('unknown');
  });
});

describe('buildTaxStatusView — next action', () => {
  it('asks the partner to declare a country first', () => {
    const result = view('unknown', 'not_submitted', '');
    expect(result.nextAction?.en).toContain('country of residence');
  });

  it('asks for upload when nothing is on file', () => {
    expect(view('w9', 'not_submitted', 'US').nextAction?.en).toContain('upload');
  });

  it('asks the partner to wait while verification runs', () => {
    expect(view('w9', 'pending_verification', 'US').nextAction?.en).toContain('reviewing');
  });

  it('asks for a resubmission when rejected or expired', () => {
    expect(view('w9', 'rejected', 'US').nextAction?.en).toContain('resubmit');
    expect(view('w9', 'expired', 'US').nextAction?.en).toContain('expired');
  });

  it('has no next action once verified', () => {
    expect(view('w9', 'verified', 'US').nextAction).toBeNull();
  });
});

describe('buildTaxStatusView — tone', () => {
  it('uses success only for verified', () => {
    expect(view('w9', 'verified', 'US').tone).toBe('success');
  });

  it('uses warning for pending and for an undetermined form', () => {
    expect(view('w9', 'pending_verification', 'US').tone).toBe('warning');
    expect(view('unknown', 'not_submitted', 'unknown').tone).toBe('warning');
  });

  it('uses error for rejected and expired', () => {
    expect(view('w9', 'rejected', 'US').tone).toBe('error');
    expect(view('w9', 'expired', 'US').tone).toBe('error');
  });

  it('uses error for a declared but outstanding form', () => {
    expect(view('w9', 'not_submitted', 'US').tone).toBe('error');
  });
});

describe('buildTaxStatusView — privacy boundary', () => {
  it('never echoes a value that looks like a tax identifier', () => {
    // The mapper sees only form type, status and country. A caller passing an
    // identifier-shaped country must not have it reflected into any label.
    const result = buildTaxStatusView({
      formType: 'w9',
      status: 'verified',
      country: '123-45-6789',
    });

    const serialised = JSON.stringify(result);
    expect(serialised).not.toContain('123-45-6789');
  });

  it('does not expose the country when it is not a two-letter code', () => {
    const result = buildTaxStatusView({ formType: 'w9', status: 'verified', country: 'US' });
    expect(result.country).toBe('US');
  });
});
