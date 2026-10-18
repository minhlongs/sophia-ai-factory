/**
 * SEPA Direct Debit Payment Rail (Core & B2B Scheme)
 *
 * Implements:
 * 1. ISO 13616 International Bank Account Number (IBAN) MOD-97-10 checksum validation
 * 2. ISO 9362 Business Identifier Code (BIC / SWIFT) validation
 * 3. EPC SEPA Rulebook compliant e-Mandate generator with Unique Mandate Reference (UMR)
 *
 * Layer: tree/rails (Pure domain service — imports only from seed)
 *
 * @module tree/rails/sepa-direct-debit
 */

import { type SepaMandateInput, type SepaMandate } from '@/seed/types/localized-rails';
import { validateIban, validateBic, maskIban } from './sepa-iban-validator';

export { validateIban, validateBic, maskIban } from './sepa-iban-validator';

/**
 * Generates an EPC SEPA Core Direct Debit Mandate.
 */
export function generateSepaMandate(input: SepaMandateInput): SepaMandate {
  const { creditorId, creditorName, debtorName, debtorIban, debtorBic } = input;

  const ibanValidation = validateIban(debtorIban);
  if (!ibanValidation.isValid || !ibanValidation.normalizedIban) {
    throw new Error(`Cannot generate mandate: ${ibanValidation.error}`);
  }

  if (debtorBic) {
    const bicValidation = validateBic(debtorBic);
    if (!bicValidation.isValid) {
      throw new Error(`Cannot generate mandate: ${bicValidation.error}`);
    }
  }

  // Generate Unique Mandate Reference (UMR): Max 35 chars, EPC compliant
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const rawUmr = input.mandateReference ?? `SAF-SEPA-${timestamp}-${randomSuffix}`;
  const umr = rawUmr.replace(/[^A-Za-z0-9\-+?/:().,']/g, '').slice(0, 35);

  const signatureDate = input.signatureDate ?? new Date().toISOString().slice(0, 10);

  return {
    mandateReference: umr,
    umr,
    creditorId,
    creditorName,
    debtorName: debtorName.trim(),
    maskedIban: maskIban(ibanValidation.normalizedIban),
    bic: debtorBic ? debtorBic.trim().toUpperCase() : undefined,
    signatureDate,
    status: 'active',
  };
}
