'use client';

/**
 * Customer Health Monitor & Anti-Churn AI Guardian Container
 *
 * Layer: Forest (UI components & presentation)
 * @module forest/growth/health-monitor/customer-health-monitor
 */

import React, { useState, useEffect, useCallback } from 'react';
import type {
  CustomerHealthMetrics,
  RetentionSummaryStats,
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
import {
  fetchCustomerRetentionPayload,
  submitFounderInterventionRequest,
} from './customer-health-api';

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

  const [activeCustomer, setActiveCustomer] = useState<CustomerHealthMetrics | null>(null);
  const [bonusCredits, setBonusCredits] = useState<number>(500);
  const [customNote, setCustomNote] = useState<string>('');
  const [notifyEmail, setNotifyEmail] = useState<boolean>(true);
  const [notifyTelegram, setNotifyTelegram] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fetchRetentionData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const payload = await fetchCustomerRetentionPayload();
      if (payload) {
        setCustomers(payload.customers);
        setSummary(payload.summary);
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
      const { succeeded, toast } = await submitFounderInterventionRequest({
        activeCustomer,
        bonusCredits,
        customNote,
        notifyEmail,
        notifyTelegram,
        isVi,
      });
      setToastMessage(toast);
      if (succeeded) {
        setActiveCustomer(null);
        await fetchRetentionData();
      }
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  const filteredCustomers = customers.filter((cust) => (filter === 'ALL' ? true : cust.status === filter));

  return (
    <div className="space-y-6">
      <ToastBanner toast={toastMessage} onDismiss={() => setToastMessage(null)} />
      <HealthMonitorHeader isVi={isVi} isRefreshing={isRefreshing} onRefresh={() => void fetchRetentionData()} />
      <HealthScoreCards summary={summary} customers={customers} isVi={isVi} />
      <FilterTabs filter={filter} setFilter={setFilter} customers={customers} isVi={isVi} />
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
