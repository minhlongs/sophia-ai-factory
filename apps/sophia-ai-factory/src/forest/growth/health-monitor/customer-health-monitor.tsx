'use client';

/**
 * Customer Health Monitor & Anti-Churn AI Guardian Container
 *
 * Layer: Forest (UI components & presentation)
 * @module forest/growth/health-monitor/customer-health-monitor
 */

import React from 'react';
import type { CustomerHealthMonitorProps } from './types';
import { ToastBanner } from './toast-banner';
import { HealthScoreCards } from './health-score-card';
import { HealthMonitorHeader, FilterTabs } from './filter-tabs';
import { RiskAlertTable } from './risk-alert-table';
import { InterventionModal } from './intervention-modal';
import { useCustomerHealthState } from './use-customer-health';

export function CustomerHealthMonitor({
  locale = 'vi',
  initialCustomers = [],
  initialSummary,
}: CustomerHealthMonitorProps) {
  const isVi = locale === 'vi';
  const state = useCustomerHealthState(initialCustomers, initialSummary, isVi);

  return (
    <div className="space-y-6">
      <ToastBanner toast={state.toastMessage} onDismiss={() => state.setToastMessage(null)} />
      <HealthMonitorHeader isVi={isVi} isRefreshing={state.isRefreshing} onRefresh={() => void state.fetchRetentionData()} />
      <HealthScoreCards summary={state.summary} customers={state.customers} isVi={isVi} />
      <FilterTabs filter={state.filter} setFilter={state.setFilter} customers={state.customers} isVi={isVi} />
      <RiskAlertTable
        loading={state.loading}
        filteredCustomers={state.filteredCustomers}
        isVi={isVi}
        onOpenIntervention={state.handleOpenIntervention}
      />
      <InterventionModal
        activeCustomer={state.activeCustomer}
        onClose={() => state.setActiveCustomer(null)}
        isVi={isVi}
        bonusCredits={state.bonusCredits}
        setBonusCredits={state.setBonusCredits}
        customNote={state.customNote}
        setCustomNote={state.setCustomNote}
        notifyEmail={state.notifyEmail}
        setNotifyEmail={state.setNotifyEmail}
        notifyTelegram={state.notifyTelegram}
        setNotifyTelegram={state.setNotifyTelegram}
        isSubmitting={state.isSubmitting}
        onExecute={state.handleExecuteIntervention}
      />
    </div>
  );
}
