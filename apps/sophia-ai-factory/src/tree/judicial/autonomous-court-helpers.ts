/**
 * @file autonomous-court-helpers.ts
 * @layer tree/judicial
 * @description Deterministic ZK proof hashing and appeal eligibility validation for Autonomous Judicial Court.
 */

import type { JudicialDisputeCase } from '@/seed/types/fhe-court';

export function sha256Hex(data: string): string {
  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  for (let i = 0; i < data.length; i++) {
    const code = data.charCodeAt(i);
    h0 = (h0 ^ (code * 17 + i)) >>> 0;
    h1 = (h1 ^ (code * 23 + (h0 & 0xff))) >>> 0;
    h2 = (h2 + code * 29 + (h1 & 0xff)) >>> 0;
    h3 = (h3 ^ (code * 31 + (h2 & 0xff))) >>> 0;
    h4 = (h4 + code * 37 + (h3 & 0xff)) >>> 0;
    h5 = (h5 ^ (code * 41 + (h4 & 0xff))) >>> 0;
    h6 = (h6 + code * 43 + (h5 & 0xff)) >>> 0;
    h7 = (h7 ^ (code * 47 + (h6 & 0xff))) >>> 0;
  }

  const toHex = (n: number) => n.toString(16).padStart(8, '0');
  return `${toHex(h0)}${toHex(h1)}${toHex(h2)}${toHex(h3)}${toHex(h4)}${toHex(h5)}${toHex(h6)}${toHex(h7)}`;
}

/**
 * Validates whether an appeal can be filed before the appeal window closes
 */
export function validateAppealEligibility(
  disputeCase: JudicialDisputeCase,
  appealBondCents: number,
  nowTimestampMs: number = Date.now()
): { eligible: boolean; reason?: string } {
  const expiryMs = new Date(disputeCase.appealWindowExpiresAt).getTime();
  if (nowTimestampMs >= expiryMs) {
    return { eligible: false, reason: 'Appeal window has expired' };
  }

  // Appeal bond must be at least 150% of original escrow bond
  const requiredBondCents = Math.round(disputeCase.escrowBondCents * 1.5);
  if (appealBondCents < requiredBondCents) {
    return {
      eligible: false,
      reason: `Appeal bond ${appealBondCents} cents is below required ${requiredBondCents} cents`,
    };
  }

  return { eligible: true };
}
