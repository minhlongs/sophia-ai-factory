/**
 * Multi-Rail Payout Destination Validator & QR Code Generator.
 *
 * Validates payout destination format across:
 * - EVM addresses (Arbitrum/Polygon USDC)
 * - VietQR (NAPAS 6-digit BIN + account)
 * - PromptPay (10-digit phone or 13-digit tax ID)
 * - SEPA Instant (IBAN)
 *
 * Layer: tree/creators/royalty
 *
 * @module tree/creators/royalty/destination-validator
 */

import type { SettlementPayoutRail } from '@/seed/types/creator-dao-c2pa';
import {
  EVM_ADDRESS_REGEX,
  PROMPTPAY_NATIONAL_ID_REGEX,
  PROMPTPAY_PHONE_REGEX,
  SEPA_IBAN_REGEX,
  VIETQR_ACCOUNT_REGEX,
  VIETQR_BANK_BIN_REGEX,
  ZERO_ADDRESS,
} from './constants';
import type { PayoutDestinationValidation } from './types';

/**
 * Validates payout rail destination parameters.
 */
export function validatePayoutDestination(
  rail: SettlementPayoutRail,
  destinationAddress: string,
  destinationBankBin?: string | null,
): PayoutDestinationValidation {
  if (!destinationAddress || destinationAddress.trim().length === 0) {
    return { valid: false, error: 'Destination address is required' };
  }

  const cleanAddr = destinationAddress.trim();

  switch (rail) {
    case 'NOWPAYMENTS_USDC_ARBITRUM':
    case 'NOWPAYMENTS_USDC_POLYGON': {
      if (!EVM_ADDRESS_REGEX.test(cleanAddr)) {
        return {
          valid: false,
          error: `Invalid EVM address format for ${rail}: ${cleanAddr}`,
        };
      }
      if (cleanAddr === ZERO_ADDRESS) {
        return {
          valid: false,
          error: 'Zero address is not allowed as a payout destination',
        };
      }
      return { valid: true };
    }

    case 'PAYOS_VIETQR': {
      if (
        !destinationBankBin ||
        !VIETQR_BANK_BIN_REGEX.test(destinationBankBin.trim())
      ) {
        return {
          valid: false,
          error: `Invalid or missing 6-digit NAPAS Bank BIN for VietQR: ${destinationBankBin}`,
        };
      }
      if (!VIETQR_ACCOUNT_REGEX.test(cleanAddr)) {
        return {
          valid: false,
          error: `Invalid bank account number for VietQR: ${cleanAddr}`,
        };
      }
      return { valid: true };
    }

    case 'PROMPTPAY': {
      const isPhone = PROMPTPAY_PHONE_REGEX.test(cleanAddr);
      const isNationalId = PROMPTPAY_NATIONAL_ID_REGEX.test(cleanAddr);
      if (!isPhone && !isNationalId) {
        return {
          valid: false,
          error: `PromptPay ID must be a 10-digit phone or 13-digit national/tax ID: ${cleanAddr}`,
        };
      }
      return { valid: true };
    }

    case 'SEPA_INSTANT': {
      const sanitizedIban = cleanAddr.replace(/\s+/g, '').toUpperCase();
      if (!SEPA_IBAN_REGEX.test(sanitizedIban)) {
        return {
          valid: false,
          error: `Invalid IBAN format for SEPA Instant: ${cleanAddr}`,
        };
      }
      return { valid: true };
    }

    default:
      return { valid: false, error: `Unsupported payout rail: ${rail}` };
  }
}

export function generatePaymentQrPayload(
  rail: SettlementPayoutRail,
  params: {
    amount: number;
    currency: string;
    destinationAddress: string;
    destinationBankBin?: string | null;
    destinationName: string;
    reference: string;
  },
): string | null {
  if (rail === 'PAYOS_VIETQR') {
    const bin = params.destinationBankBin?.trim() ?? '';
    const acc = params.destinationAddress.trim();
    const memo = encodeURIComponent(params.reference);
    const name = encodeURIComponent(params.destinationName.trim());
    return `https://img.vietqr.io/image/${bin}-${acc}-compact2.png?amount=${Math.round(params.amount)}&addInfo=${memo}&accountName=${name}`;
  }

  if (rail === 'PROMPTPAY') {
    const id = params.destinationAddress.trim();
    const amountStr = params.amount.toFixed(2);
    return `promptpay://${id}?amount=${amountStr}&ref=${encodeURIComponent(params.reference)}`;
  }

  return null;
}
