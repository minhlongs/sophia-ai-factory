import type {
  CreatorTemplate,
  CreatorStudioStats,
  WithdrawalRequest,
  PayoutRail,
  CreatorTemplatePlatform,
} from '@/seed/types/creator-marketplace';

export type {
  CreatorTemplate,
  CreatorStudioStats,
  WithdrawalRequest,
  PayoutRail,
  CreatorTemplatePlatform,
};

export interface PageProps {
  params: Promise<{
    locale: string;
  }>;
}

export interface NapasBank {
  bin: string;
  name: string;
  short: string;
}

export interface TemplateFormData {
  title: string;
  description: string;
  niche: string;
  targetPlatform: CreatorTemplatePlatform;
  aspectRatio: '9:16' | '16:9' | '1:1';
  hookStyle: string;
  scriptTemplate: string;
  visualStylePrompt: string;
  musicPrompt: string;
  priceDollars: string;
}

export interface WithdrawFormData {
  amountDollars: string;
  rail: PayoutRail;
  destinationAddress: string;
  bankBin: string;
  bankAccountNumber: string;
  bankAccountName: string;
}

export interface ActiveQrModalState {
  qrUrl: string;
  amountVnd: number;
  amountUsd: number;
  bankName: string;
  accountNumber: string;
}

export type WithdrawalWithQr = WithdrawalRequest & {
  vietQr?: { qrUrl: string; amountVnd: number; amountUsd: number } | null;
};
