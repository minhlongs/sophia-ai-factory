'use client';

/**
 * State hook for Customer Health Monitor container.
 * Layer: Forest (UI hooks)
 * @module forest/growth/health-monitor/use-customer-health
 */

import { useState, useEffect, useCallback } from 'react';
import type {
  CustomerHealthMetrics,
  RetentionSummaryStats,
} from '@/seed/types/retention-types';
import type { HealthFilterType, ToastState } from './types';
import {
  fetchCustomerRetentionPayload,
  submitFounderInterventionRequest,
} from './customer-health-api';

export function useCustomerHealthState(
  initialCustomers: CustomerHealthMetrics[],
  initialSummary?: RetentionSummaryStats,
  isVi: boolean = false,
) {
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

  return {
    customers, summary, filter, setFilter, loading, isRefreshing,
    toastMessage, setToastMessage, activeCustomer, setActiveCustomer,
    bonusCredits, setBonusCredits, customNote, setCustomNote,
    notifyEmail, setNotifyEmail, notifyTelegram, setNotifyTelegram,
    isSubmitting, fetchRetentionData, handleOpenIntervention,
    handleExecuteIntervention, filteredCustomers,
  };
}
