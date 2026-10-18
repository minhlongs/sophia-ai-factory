/**
 * Creator Royalty Payout Destination Resolution & Validation Helper.
 *
 * Layer: tree/creators/royalty
 *
 * @module tree/creators/royalty/settlement-destination-resolver
 */

import type {
  CreatorLicensingContract,
  ExecuteRoyaltySplitInput,
  SettlementPayoutRail,
} from '@/seed/types/creator-dao-c2pa';
import { DEFAULT_DESTINATION_ADDRESS } from './constants';
import { validatePayoutDestination } from './destination-validator';

export interface ResolvedSettlementDestination {
  valid: boolean;
  error?: string;
  payoutRail: SettlementPayoutRail;
  destinationAddress: string;
  destinationBankBin: string | null;
  destinationName: string;
}

export function resolveAndValidateDestination(
  input: ExecuteRoyaltySplitInput,
  contract: CreatorLicensingContract,
): ResolvedSettlementDestination {
  const payoutRail = input.payoutRail ?? contract.preferredPayoutRail;
  const destinationAddress =
    input.destinationAddress ?? DEFAULT_DESTINATION_ADDRESS;
  const destinationBankBin = input.destinationBankBin ?? null;
  const destinationName = input.destinationName ?? 'Creator Payee';

  const destValidation = validatePayoutDestination(
    payoutRail,
    destinationAddress,
    destinationBankBin,
  );

  return {
    valid: destValidation.valid,
    error: destValidation.error,
    payoutRail,
    destinationAddress,
    destinationBankBin,
    destinationName,
  };
}
