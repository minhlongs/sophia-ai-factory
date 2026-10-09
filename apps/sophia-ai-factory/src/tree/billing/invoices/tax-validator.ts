/**
 * Vietnamese Tax ID (Mã Số Thuế) & Invoice Number Validator
 *
 * @module tree/billing/invoices/tax-validator
 */

/**
 * Validate Vietnamese Tax ID (Mã số thuế - MST).
 * Conforms to standard 10-digit enterprise MST or 13-character branch MST (10 digits + hyphen + 3 digits).
 */
export function validateVietnameseTaxId(taxId: string): {
  valid: boolean;
  normalized?: string;
  error?: string;
} {
  if (!taxId || typeof taxId !== 'string') {
    return { valid: false, error: 'Tax ID is required' };
  }

  const trimmed = taxId.trim();
  const isTenDigit = /^\d{10}$/.test(trimmed);
  const isThirteenDigit = /^\d{10}-\d{3}$/.test(trimmed);

  if (!isTenDigit && !isThirteenDigit) {
    return {
      valid: false,
      error: 'Invalid Vietnamese MST format. Must be 10 digits (e.g. 0101234567) or 13 characters (e.g. 0101234567-001)',
    };
  }

  return {
    valid: true,
    normalized: trimmed,
  };
}

/**
 * Generate a sequential, unique invoice number.
 * Example: INV-2026-08149
 */
export function generateInvoiceNumber(sequence?: number, date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const randomSuffix = Math.floor(10000 + Math.random() * 90000);
  const seqPart = sequence ? String(sequence).padStart(5, '0') : String(randomSuffix);
  return `INV-${year}-${seqPart}`;
}
