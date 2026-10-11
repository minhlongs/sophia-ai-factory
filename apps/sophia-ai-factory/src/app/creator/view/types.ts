import type { getTranslations } from 'next-intl/server';
import type { CreatorProfileView } from '@/land/sop-marketplace';
import type { SopChallengeRow, UserChallengeProgressRow } from '@/tree/sop/sop-types';

export type TranslationFn = Awaited<ReturnType<typeof getTranslations>>;

export interface EarningsBreakdown {
  totalEarned: number;
  pending: number;
  payable: number;
  paid: number;
}

export interface ProfileCardProps {
  profile: CreatorProfileView;
  t: TranslationFn;
}

export interface OnboardingViewProps {
  t: TranslationFn;
}

export interface EarningsSectionProps {
  profile: CreatorProfileView;
  totalInstalls: number;
  earningsBreakdown: EarningsBreakdown;
  t: TranslationFn;
}

export interface ChallengesSectionProps {
  challenges: SopChallengeRow[];
  userProgress: UserChallengeProgressRow[];
  locale: string;
  t: TranslationFn;
}

export interface DashboardViewProps {
  profile: CreatorProfileView;
  totalInstalls: number;
  earningsBreakdown: EarningsBreakdown;
  challenges: SopChallengeRow[];
  userProgress: UserChallengeProgressRow[];
  locale: string;
  t: TranslationFn;
}
