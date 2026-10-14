'use client';

/**
 * API client helpers for CustomerHealthMonitor.
 * @module forest/growth/health-monitor/customer-health-api
 */

import type {
  CustomerHealthMetrics,
  RetentionSummaryStats,
  FounderInterventionResult,
} from '@/seed/types/retention-types';
import type { ToastState } from './types';

export async function fetchCustomerRetentionPayload(): Promise<{
  customers: CustomerHealthMetrics[];
  summary: RetentionSummaryStats | null;
} | null> {
  const res = await fetch('/api/admin/customer-intervention');
  if (!res.ok) return null;
  const data = (await res.json()) as {
    ok: boolean;
    summary: RetentionSummaryStats;
    customers: CustomerHealthMetrics[];
  };
  if (!data.ok) return null;
  return {
    customers: data.customers || [],
    summary: data.summary || null,
  };
}

export async function submitFounderInterventionRequest(params: {
  activeCustomer: CustomerHealthMetrics;
  bonusCredits: number;
  customNote: string;
  notifyEmail: boolean;
  notifyTelegram: boolean;
  isVi: boolean;
}): Promise<{ succeeded: boolean; toast: ToastState }> {
  const { activeCustomer, bonusCredits, customNote, notifyEmail, notifyTelegram, isVi } = params;
  try {
    const res = await fetch('/api/admin/customer-intervention', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: activeCustomer.userId,
        bonusCredits,
        customMessage: customNote || undefined,
        notifyEmail,
        notifyTelegram,
      }),
    });

    const data = (await res.json()) as {
      ok: boolean;
      result?: FounderInterventionResult;
      error?: string;
    };

    if (res.ok && data.ok) {
      return {
        succeeded: true,
        toast: {
          text: isVi
            ? `Đã tặng thành công +${bonusCredits} MCU cho ${activeCustomer.userEmail}!`
            : `Successfully granted +${bonusCredits} MCU to ${activeCustomer.userEmail}!`,
          type: 'success',
        },
      };
    }
    return {
      succeeded: false,
      toast: {
        text: data.error || (isVi ? 'Can thiệp thất bại' : 'Intervention failed'),
        type: 'error',
      },
    };
  } catch {
    return {
      succeeded: false,
      toast: {
        text: isVi ? 'Lỗi kết nối khi gửi yêu cầu' : 'Network error executing intervention',
        type: 'error',
      },
    };
  }
}
