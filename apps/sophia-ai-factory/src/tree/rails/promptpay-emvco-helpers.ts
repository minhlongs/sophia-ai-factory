/**
 * EMVCo TLV, CRC16-CCITT, and PromptPay Recipient Formatting Helpers
 *
 * Layer: tree/rails (Pure domain helpers)
 *
 * @module tree/rails/promptpay-emvco-helpers
 */

/**
 * Formats an EMVCo TLV (Tag-Length-Value) segment.
 */
export function formatTlv(tag: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${tag}${len}${value}`;
}

/**
 * Computes CRC16-CCITT (Polynomial 0x1021, Initial 0xFFFF) per EMVCo QR Specification.
 */
export function calculateCrc16Ccitt(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    const code = data.charCodeAt(i);
    crc ^= (code << 8);
    for (let bit = 0; bit < 8; bit++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Formats a recipient identifier for PromptPay Tag 29.
 * - Mobile: 10 digits (e.g. 0812345678) -> 0066812345678 (13 digits)
 * - National ID / Tax ID: 13 digits
 * - e-Wallet ID: 15 digits
 */
export function formatPromptPayRecipient(
  recipient: string,
): { subTag: string; formattedValue: string } {
  const cleaned = recipient.replace(/[\s-]/g, '');

  // 1. Mobile number starting with 0 (e.g. 0812345678 -> 10 digits)
  if (/^0[0-9]{9}$/.test(cleaned)) {
    const mobileWithoutZero = cleaned.substring(1);
    const formatted = `0066${mobileWithoutZero}`;
    return { subTag: '01', formattedValue: formatted };
  }

  // Mobile with 66 prefix (e.g. 66812345678 -> 11 digits)
  if (/^66[0-9]{9}$/.test(cleaned)) {
    const formatted = `00${cleaned}`;
    return { subTag: '01', formattedValue: formatted };
  }

  // 2. National ID / Tax ID (13 digits)
  if (/^[0-9]{13}$/.test(cleaned)) {
    return { subTag: '02', formattedValue: cleaned };
  }

  // 3. E-Wallet ID (15 digits)
  if (/^[0-9]{15}$/.test(cleaned)) {
    return { subTag: '03', formattedValue: cleaned };
  }

  throw new Error(
    `Invalid PromptPay recipient: "${recipient}". Must be 10-digit mobile, 13-digit National ID/Tax ID, or 15-digit e-Wallet ID.`,
  );
}
