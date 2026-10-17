/**
 * Forest Layer: Live Telemetry Orchestrator for Stitch Director's Control Deck
 * Bridges Seed Auth + Tree Readiness + Forest Dashboard Metrics into ControlDeckDataset.
 * Layer: forest/control-deck | Max LOC: < 180 | Zero :any | Zero console.log
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import type {
  ControlDeckDataset,
  ControlDeckPaymentEntry,
} from '@/seed/types/stitch-control-deck';
import { computeLiveControlDeckDataset } from '@/tree/control-deck';
import {
  verifyUserReadiness,
  type SystemReadiness,
} from '@/tree/readiness/readiness-checker';
import { fetchCurrentUserDashboard } from '@/forest/dashboard/metrics';

export interface LiveControlDeckPayload {
  readonly dataset: ControlDeckDataset;
  readonly readiness: SystemReadiness | null;
  readonly isLiveAuthenticated: boolean;
}

function localizedPaymentStatus(status: string): { en: string; vi: string } {
  const normalized = status.trim().toLowerCase();
  const known: Record<string, { en: string; vi: string }> = {
    paid: { en: 'Paid', vi: 'Đã thanh toán' },
    completed: { en: 'Completed', vi: 'Hoàn tất' },
    pending: { en: 'Pending', vi: 'Đang chờ' },
    failed: { en: 'Failed', vi: 'Thất bại' },
    refunded: { en: 'Refunded', vi: 'Đã hoàn tiền' },
  };
  return known[normalized] ?? {
    en: status.trim() || 'Unknown',
    vi: status.trim() ? `Trạng thái: ${status.trim()}` : 'Chưa rõ',
  };
}

export async function loadLiveControlDeckTelemetry(): Promise<LiveControlDeckPayload> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        dataset: computeLiveControlDeckDataset(),
        readiness: null,
        isLiveAuthenticated: false,
      };
    }

    let readiness: SystemReadiness | null = null;
    try {
      readiness = await verifyUserReadiness({
        userId: user.id,
        userEmail: user.email,
        emailVerified: (user as { emailVerified?: boolean }).emailVerified,
      });
    } catch {
      readiness = null;
    }

    const dashResult = await fetchCurrentUserDashboard();
    const dashData = dashResult.ok ? dashResult.data : undefined;

    const liveSettlements: ControlDeckPaymentEntry[] = (
      dashData?.recentActivities ?? []
    )
      .filter((act) => act.type === 'payment' && Boolean(act.amount))
      .slice(0, 4)
      .map((act) => ({
        txId: act.id,
        provider: { en: 'Not recorded', vi: 'Chưa ghi nhận' },
        grossAmountUsd: act.amount ?? '',
        status: localizedPaymentStatus(act.status),
        timestampUtc: act.date,
        source: 'account' as const,
      }));

    const dataset = computeLiveControlDeckDataset({
      ...(readiness ? { mcuBudget: readiness.mcuBalance, byokReady: readiness.byokEncrypted } : {}),
      ...(liveSettlements.length > 0 ? { liveSettlements } : {}),
    });

    return {
      dataset,
      readiness,
      isLiveAuthenticated: true,
    };
  } catch {
    return {
      dataset: computeLiveControlDeckDataset(),
      readiness: null,
      isLiveAuthenticated: false,
    };
  }
}
