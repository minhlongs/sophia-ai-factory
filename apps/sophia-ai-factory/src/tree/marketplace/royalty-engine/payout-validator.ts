/**
 * @file payout-validator.ts
 * @description Payout rail formatting validation for USDT and VietQR rails.
 * @layer tree
 */

import type { PayoutRail } from '../types';

/**
 * Validates payout rail parameters.
 * Throws descriptive errors if formatting is invalid.
 */
export function validatePayoutRail(
  rail: PayoutRail,
  details: {
    destinationAddress?: string;
    bankBin?: string;
    bankAccountNumber?: string;
    bankAccountName?: string;
  },
): void {
  if (rail === 'USDT') {
    const addr = details.destinationAddress?.trim();
    if (!addr || addr.length < 10) {
      throw new Error('INVALID_USDT_ADDRESS: Destination address must be at least 10 characters.');
    }
    // Basic address pattern check (ERC20 0x..., TRC20 T..., Solana/base58)
    const validAddressRegex = /^(0x[a-fA-F0-9]{40}|T[A-Za-z1-9]{33}|[1-9A-HJ-NP-Za-km-z]{26,44})$/;
    if (!validAddressRegex.test(addr)) {
      throw new Error('INVALID_USDT_ADDRESS: Malformed USDT wallet address format.');
    }
  } else if (rail === 'VIETQR') {
    const bin = details.bankBin?.trim();
    if (!bin || !/^\d{6}$/.test(bin)) {
      throw new Error('INVALID_VIETQR_BIN: Must provide a valid 6-digit NAPAS bank BIN code.');
    }
    const accNum = details.bankAccountNumber?.trim();
    if (!accNum || accNum.length < 4 || !/^[a-zA-Z0-9]+$/.test(accNum)) {
      throw new Error('INVALID_VIETQR_ACCOUNT_NUMBER: Bank account number must be at least 4 alphanumeric characters.');
    }
    const accName = details.bankAccountName?.trim();
    if (!accName || accName.length < 2) {
      throw new Error('INVALID_VIETQR_ACCOUNT_NAME: Account holder name must be at least 2 characters.');
    }
  } else {
    throw new Error(`UNSUPPORTED_PAYOUT_RAIL: Rail '${rail}' is not supported.`);
  }
}
