/**
 * Handover Document Generator Types
 *
 * Layer: tree/handover
 */

import type { Tier } from '@/seed/types';
import type { AgencyType } from '@/tree/handover/handover-types';

export interface HandoverDocInput {
  customerId: string;
  agencyName: string;
  ownerFullName: string;
  ownerEmail: string;
  tier: Tier;
  agencyType: AgencyType;
  locale: string;
  installedSops: string[];
  magicLinkUrl: string;
  contractDate: string;
}
