import type { InviteAffiliateResult } from '@/forest/actions/affiliate-actions';

export interface InviteAffiliateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInviteSuccess?: (result: InviteAffiliateResult) => void;
}

export type AssetKitLabelKey = 'kitBrand' | 'kitScripts' | 'kitSwipes' | 'kitBroll';

export interface AssetKitOption {
  id: string;
  labelKey: AssetKitLabelKey;
}

export const ASSET_KIT_OPTIONS: AssetKitOption[] = [
  { id: 'brand_kit', labelKey: 'kitBrand' },
  { id: 'video_scripts', labelKey: 'kitScripts' },
  { id: 'email_swipes', labelKey: 'kitSwipes' },
  { id: 'demo_broll', labelKey: 'kitBroll' },
];
