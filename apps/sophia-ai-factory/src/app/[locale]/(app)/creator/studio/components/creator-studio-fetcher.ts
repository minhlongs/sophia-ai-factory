'use client';

import type { CreatorTemplate, CreatorStudioStats } from '@/seed/types/creator-marketplace';
import type { WithdrawalWithQr } from './types';

export const INITIAL_STUDIO_STATS: CreatorStudioStats = {
  totalTemplates: 0,
  totalUses: 0,
  grossEarningsCents: 0,
  creatorRoyaltyCents: 0,
  platformFeesCents: 0,
  availableBalanceCents: 0,
  pendingBalanceCents: 0,
  averageRating: 0,
  totalReviews: 0,
};

export interface StudioOverviewPayload {
  templates?: CreatorTemplate[];
  withdrawals?: WithdrawalWithQr[];
  unencumberedCents?: number;
}

export async function fetchCreatorStudioOverview(): Promise<StudioOverviewPayload> {
  const [tmplRes, withRes] = await Promise.all([
    fetch('/api/creator/templates'),
    fetch('/api/creator/withdrawals'),
  ]);

  const payload: StudioOverviewPayload = {};

  if (tmplRes.ok) {
    const tmplData = (await tmplRes.json()) as { templates: CreatorTemplate[]; total: number };
    payload.templates = tmplData.templates || [];
  }

  if (withRes.ok) {
    const withData = (await withRes.json()) as {
      withdrawals: WithdrawalWithQr[];
      balances?: { availableCents: number; unencumberedCents: number };
    };
    payload.withdrawals = withData.withdrawals || [];
    if (withData.balances) {
      payload.unencumberedCents = withData.balances.unencumberedCents;
    }
  }

  return payload;
}

export function getMaintenanceErrorMessage(isVi: boolean, fallbackEn: string): string {
  return isVi
    ? 'Creator Marketplace tạm thời bảo trì. Vui lòng quay lại sau.'
    : fallbackEn;
}
