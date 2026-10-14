import type { Iso20022MessageType } from '@/seed/types/central-bank-clearing';

export interface GeneratePacs009Params {
  endToEndId: string;
  uetr: string;
  instructingBic: string;
  instructedBic: string;
  amountCents: number;
  currency: string;
  settlementDate: string;
}

export interface ParseIso20022Result {
  isValid: boolean;
  messageType: Iso20022MessageType | 'UNKNOWN';
  endToEndId: string;
  uetr: string;
  amountCents: number;
  currency: string;
  instructingBic: string;
  instructedBic: string;
  error?: string;
}
