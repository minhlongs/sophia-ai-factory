import type { NapasBank, TemplateFormData, WithdrawFormData } from './types';

export const NAPAS_BANKS: NapasBank[] = [
  { bin: '970422', name: 'MBBank (NHTM CP Quân Đội)', short: 'MB' },
  { bin: '970436', name: 'Vietcombank (Ngoại Thương Việt Nam)', short: 'VCB' },
  { bin: '970407', name: 'Techcombank (Kỹ Thương Việt Nam)', short: 'TCB' },
  { bin: '970416', name: 'ACB (Á Châu)', short: 'ACB' },
  { bin: '970415', name: 'VietinBank (Công Thương Việt Nam)', short: 'CTG' },
  { bin: '970432', name: 'VPBank (Việt Nam Thịnh Vượng)', short: 'VPB' },
  { bin: '970423', name: 'TPBank (Tiên Phong)', short: 'TPB' },
];

export const INITIAL_TEMPLATE_FORM: TemplateFormData = {
  title: '',
  description: '',
  niche: 'general',
  targetPlatform: 'tiktok',
  aspectRatio: '9:16',
  hookStyle: 'curiosity_gap',
  scriptTemplate: '',
  visualStylePrompt: '',
  musicPrompt: '',
  priceDollars: '20',
};

export const INITIAL_WITHDRAW_FORM: WithdrawFormData = {
  amountDollars: '50',
  rail: 'USDT',
  destinationAddress: '',
  bankBin: '970422',
  bankAccountNumber: '',
  bankAccountName: '',
};

export const USD_TO_VND_RATE = 25450;

export const formatUsd = (cents: number): string =>
  `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
