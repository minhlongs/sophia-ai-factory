'use client';

import React, { useState } from 'react';
import { User, Key, BarChart3, Users, Languages } from 'lucide-react';
import { cn } from '@/seed/utils/cn';
import { Link } from '@/navigation';
import { SettingsProfileSection } from '@/components/settings/settings-profile-section';
import { ApiKeysManager } from '@/components/settings/api-keys-manager';
import { AccountOwnershipView } from '@/components/settings/account-ownership-view';
import { SettingsLocaleDangerSection } from '@/components/settings/settings-locale-danger';

interface SettingsPageProps {
  userName?: string;
  userEmail?: string;
  currentTier?: string;
  periodEnd?: string | null;
  completedOrderCount?: number;
}

const NAV_TABS = [
  { id: 'account', label: 'Profile', icon: User },
  { id: 'apiKeys', label: 'API Keys (BYOK)', icon: Key },
  { id: 'usage', label: 'Live Metering', icon: BarChart3 },
  { id: 'team', label: 'Team & Ownership', icon: Users },
  { id: 'preferences', label: 'Preferences', icon: Languages },
];

export default function SettingsPage({
  userName = '',
  userEmail = '',
}: SettingsPageProps = {}) {
  const [activeTab, setActiveTab] = useState('account');

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-outline-variant/30 pb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-on-surface">
              Account & Workspace Settings
            </h1>
            <p className="text-xs sm:text-sm text-on-surface-variant mt-1">
              Manage personal identity, live AI provider credentials, usage telemetry, and team ownership.
            </p>
          </div>
          <Link
            href="/settings/usage"
            className="inline-flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            <BarChart3 className="w-4 h-4" />
            View Billing Metering
          </Link>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-outline-variant/20 custom-scrollbar">
          {NAV_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap',
                  isActive
                    ? 'bg-primary text-white shadow-lg shadow-primary/25'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest/60',
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Panels */}
        <main className="space-y-8">
          {activeTab === 'account' && (
            <SettingsProfileSection initialName={userName} email={userEmail} />
          )}

          {activeTab === 'apiKeys' && (
            <ApiKeysManager />
          )}

          {activeTab === 'usage' && (
            <div className="bg-[#18181B] rounded-2xl p-8 shadow-xl border border-outline-variant/20 text-center space-y-4">
              <BarChart3 className="w-10 h-10 text-primary mx-auto" />
              <div className="max-w-md mx-auto space-y-2">
                <h3 className="text-lg font-bold text-on-surface">Transparent Consumption Ledger</h3>
                <p className="text-xs text-on-surface-variant">
                  Inspect granular video generation minutes, ElevenLabs synthesis, fal.ai diffusion calls, and LLM tokens.
                </p>
              </div>
              <Link
                href="/settings/usage"
                className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-95"
              >
                Open Real-Time Metering Portal
              </Link>
            </div>
          )}

          {activeTab === 'team' && (
            <AccountOwnershipView />
          )}

          {activeTab === 'preferences' && (
            <SettingsLocaleDangerSection />
          )}
        </main>
      </div>
    </div>
  );
}
