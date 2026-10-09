/**
 * Unit Economics Dashboard Submodule: Main Dashboard View Component.
 * Layer: forest (Presentation component)
 *
 * @module forest/economics/dashboard/dashboard-view
 */

'use client';

import React, { useState } from 'react';
import type { UnitEconomicsSummary } from '@/seed/types/unit-economics-types';
import type { DashboardTab, UnitEconomicsDashboardProps } from './types';
import { DashboardHeader } from './dashboard-header';
import { HeroKpiCards } from './hero-kpi-cards';
import { OverviewTab } from './overview-tab';
import { ProvidersTab } from './providers-tab';
import { TiersTab } from './tiers-tab';
import { SimulatorTab } from './simulator-tab';

export function UnitEconomicsDashboard({
  initialData,
  locale = 'vi',
}: UnitEconomicsDashboardProps) {
  const [data] = useState<UnitEconomicsSummary>(initialData);
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 sm:p-6 lg:p-8 space-y-8 font-sans">
      <DashboardHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        locale={locale}
      />

      <HeroKpiCards data={data} locale={locale} />

      {activeTab === 'overview' && <OverviewTab data={data} locale={locale} />}
      {activeTab === 'providers' && (
        <ProvidersTab providerCosts={data.providerCosts} locale={locale} />
      )}
      {activeTab === 'tiers' && (
        <TiersTab tierEconomics={data.tierEconomics} locale={locale} />
      )}
      {activeTab === 'simulator' && <SimulatorTab locale={locale} />}
    </div>
  );
}
