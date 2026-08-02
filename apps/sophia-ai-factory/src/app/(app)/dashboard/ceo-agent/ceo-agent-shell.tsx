'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { BrainCircuit, BarChart3, TrendingUp, Play } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/seed/components/ui/tabs';
import { CeoAgentDashboard } from './ceo-agent-dashboard';
import { CeoAgentOnboardingWrapper } from '@/forest/components/agents/ceo-agent-onboarding-wrapper';

const TABS = [
  { id: 'briefing', labelKey: 'tabs.briefing', icon: BrainCircuit },
  { id: 'campaigns', labelKey: 'tabs.campaigns', icon: BarChart3 },
  { id: 'revenue', labelKey: 'tabs.revenue', icon: TrendingUp },
] as const;

interface ShellProps {
  locale: string;
  userId: string;
}

export function CeoAgentShell({ locale, userId }: ShellProps) {
  const t = useTranslations('dashboard.ceoAgent');
  const [activeTab, setActiveTab] = useState('briefing');

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>

        {/* Onboarding (first-time experience) */}
        <CeoAgentOnboardingWrapper />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <TabsList className="grid w-full grid-cols-3">
            {TABS.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="gap-2"
                aria-label={t(tab.labelKey)}
              >
                <tab.icon className="w-4 h-4" aria-hidden="true" />
                <span className="hidden sm:inline">{t(tab.labelKey)}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="briefing" className="mt-4">
            <CeoAgentDashboard locale={locale} userId={userId} tab="briefing" />
          </TabsContent>
          <TabsContent value="campaigns" className="mt-4">
            <CeoAgentDashboard locale={locale} userId={userId} tab="campaigns" />
          </TabsContent>
          <TabsContent value="revenue" className="mt-4">
            <CeoAgentDashboard locale={locale} userId={userId} tab="revenue" />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
