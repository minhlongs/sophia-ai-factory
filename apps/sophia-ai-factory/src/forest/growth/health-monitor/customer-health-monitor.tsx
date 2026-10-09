'use client';

/**
 * Customer Health Monitor & Anti-Churn AI Guardian Container
 *
 * Real-time client retention monitor with 4-factor health scoring,
 * churn risk categorization, and 1-Click Founder Intervention modal.
 *
 * Layer: Forest (UI components & presentation)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module forest/growth/health-monitor/customer-health-monitor
 */

import React, { useState, useEffect, useCallback } from 'react';
import type {
  CustomerHealthMetrics,
  RetentionSummaryStats,
  FounderInterventionResult,
} from '@/seed/types/retention-types';
import type {
  CustomerHealthMonitorProps,
  HealthFilterType,
  ToastState,
} from './types';
import { ToastBanner } from './toast-banner';
import { HealthScoreCards } from './health-score-card';
import { HealthMonitorHeader, FilterTabs } from './filter-tabs';
import { RiskAlertTable } from './risk-alert-table';
import { InterventionModal } from './intervention-modal';

export function CustomerHealthMonitor({
  locale = 'vi',
  initialCustomers = [],
  initialSummary,
}: CustomerHealthMonitorProps) {
  const isVi = locale === 'vi';

  const [customers, setCustomers] = useState<CustomerHealthMetrics[]>(initialCustomers);
  const [summary, setSummary] = useState<RetentionSummaryStats | null>(initialSummary ?? null);
  const [filter, setFilter] = useState<HealthFilterType>('ALL');
  const [loading, setLoading] = useState<boolean>(initialCustomers.length === 0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<ToastState | null>(null);

  // Modal State for 1-Click Founder Action
  const [activeCustomer, setActiveCustomer] = useState<CustomerHealthMetrics | null>(null);
  const [bonusCredits, setBonusCredits] = useState<number>(500);
  const [customNote, setCustomNote] = useState<string>('');
  const [notifyEmail, setNotifyEmail] = useState<boolean>(true);
  const [notifyTelegram, setNotifyTelegram] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fetchRetentionData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/admin/customer-intervention');
      if (res.ok) {
        const data = (await res.json()) as {
          ok: boolean;
          summary: RetentionSummaryStats;
          customers: CustomerHealthMetrics[];
        };
        if (data.ok) {
          setCustomers(data.customers || []);
          setSummary(data.summary || null);
        }
      }
    } catch {
      // Non-fatal client fetch error
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialCustomers.length === 0) {
      void fetchRetentionData();
    }
  }, [fetchRetentionData, initialCustomers.length]);

  const handleOpenIntervention = (cust: CustomerHealthMetrics) => {
    setActiveCustomer(cust);
    setBonusCredits(500);
    setCustomNote('');
  };

  const handleExecuteIntervention = async () => {
    if (!activeCustomer) return;
    setIsSubmitting(true);
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
        setToastMessage({
          text: isVi
            ? `Đã tặng thành công +${bonusCredits} MCU cho ${activeCustomer.userEmail}!`
            : `Successfully granted +${bonusCredits} MCU to ${activeCustomer.userEmail}!`,
          type: 'success',
        });
        setActiveCustomer(null);
        await fetchRetentionData();
      } else {
        setToastMessage({
          text: data.error || (isVi ? 'Can thiệp thất bại' : 'Intervention failed'),
          type: 'error',
        });
      }
    } catch {
      setToastMessage({
        text: isVi ? 'Lỗi kết nối khi gửi yêu cầu' : 'Network error executing intervention',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  const filteredCustomers = customers.filter((cust) => {
    if (filter === 'ALL') return true;
    return cust.status === filter;
  });

  return (
    <div className="space-y-6">
      <ToastBanner toast={toastMessage} onDismiss={() => setToastMessage(null)} />

      <HealthMonitorHeader
        isVi={isVi}
        isRefreshing={isRefreshing}
        onRefresh={() => void fetchRetentionData()}
      />

      <HealthScoreCards
        summary={summary}
        customers={customers}
        isVi={isVi}
      />

      <FilterTabs
        filter={filter}
        setFilter={setFilter}
        customers={customers}
        isVi={isVi}
      />

      <RiskAlertTable
        loading={loading}
        filteredCustomers={filteredCustomers}
        isVi={isVi}
        onOpenIntervention={handleOpenIntervention}
      />

      <InterventionModal
        activeCustomer={activeCustomer}
        onClose={() => setActiveCustomer(null)}
        isVi={isVi}
        bonusCredits={bonusCredits}
        setBonusCredits={setBonusCredits}
        customNote={customNote}
        setCustomNote={setCustomNote}
        notifyEmail={notifyEmail}
        setNotifyEmail={setNotifyEmail}
        notifyTelegram={notifyTelegram}
        setNotifyTelegram={setNotifyTelegram}
        isSubmitting={isSubmitting}
        onExecute={handleExecuteIntervention}
      />
    </div>
  );
}
