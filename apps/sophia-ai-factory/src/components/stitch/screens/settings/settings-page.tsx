'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { User, Key, BarChart3, Users, Languages, HardDrive, Shield, Fingerprint } from 'lucide-react';
import { cn } from '@/seed/utils/cn';
import { Link } from '@/navigation';
import { SettingsProfileSection } from '@/components/settings/settings-profile-section';
import { SettingsSecuritySection } from '@/components/settings/settings-security-section';
import { ApiKeysManager } from '@/components/settings/api-keys-manager';
import { StorageSettingsForm } from '@/components/settings/storage-settings-form';
import { AccountOwnershipView } from '@/components/settings/account-ownership-view';
import { SettingsAppearanceThemeSection } from '@/components/settings/settings-appearance-theme';
import { SettingsLocaleDangerSection } from '@/components/settings/settings-locale-danger';
import { SettingsJurisdictionPicker } from '@/components/settings/settings-jurisdiction-picker';
import { OpenCorePortabilityPanel } from '@/components/settings/open-core-portability-panel';

interface SettingsPageProps {
  userName?: string;
  userEmail?: string;
  currentTier?: string;
  periodEnd?: string | null;
  completedOrderCount?: number;
  initialTab?: string;
}

const NAV_TAB_SPECS = [
  { id: 'account', labelKey: 'tabs.account', fallback: 'Profile', icon: User },
  { id: 'security', labelKey: 'tabs.security', fallback: 'Security (Passkeys & 2FA)', icon: Fingerprint },
  { id: 'apiKeys', labelKey: 'tabs.apiKeys', fallback: 'API Keys (BYOK)', icon: Key },
  { id: 'storage', labelKey: 'tabs.storage', fallback: 'Storage (R2 BYOS)', icon: HardDrive },
  { id: 'usage', labelKey: 'tabs.usage', fallback: 'Live Metering', icon: BarChart3 },
  { id: 'team', labelKey: 'tabs.team', fallback: 'Team & Ownership', icon: Users },
  { id: 'openCore', labelKey: 'tabs.openCore', fallback: 'Open-Core & Portability', icon: Shield },
  { id: 'preferences', labelKey: 'tabs.preferences', fallback: 'Preferences', icon: Languages },
] as const;

export default function SettingsPage({
  userName = '',
  userEmail = '',
  initialTab = 'account',
}: SettingsPageProps = {}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const t = useTranslations('stitch.settingsPage');

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-foreground">
              {t('title')}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {t('subtitle')}
            </p>
          </div>
          <Link
            href="/settings/usage"
            className="inline-flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary-text border border-primary/30 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all shadow-sm"
          >
            <BarChart3 className="w-4 h-4" />
            {t('viewBillingMetering')}
          </Link>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-border custom-scrollbar">
          {NAV_TAB_SPECS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{t(tab.labelKey)}</span>
              </button>
            );
          })}
        </div>

        <div className="space-y-8">
          {activeTab === 'account' && <SettingsProfileSection initialName={userName} email={userEmail} />}
          {activeTab === 'security' && <SettingsSecuritySection />}
          {activeTab === 'apiKeys' && <ApiKeysManager />}
          {activeTab === 'storage' && (
            <div className="bg-card rounded-2xl p-6 sm:p-8 shadow-sm border border-border">
              <StorageSettingsForm />
            </div>
          )}
          {activeTab === 'usage' && (
            <div className="bg-card rounded-2xl p-8 shadow-sm border border-border text-center space-y-4">
              <BarChart3 className="w-10 h-10 text-primary mx-auto" />
              <div className="max-w-md mx-auto space-y-2">
                <h3 className="text-lg font-bold text-foreground">{t('usagePanel.title')}</h3>
                <p className="text-xs text-muted-foreground">
                  {t('usagePanel.description')}
                </p>
              </div>
              <Link
                href="/settings/usage"
                className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground dark:bg-primary-600 dark:hover:bg-primary-500 dark:text-white text-xs font-mono font-bold px-5 py-2.5 rounded-xl shadow-sm transition-all active:scale-95"
              >
                {t('usagePanel.cta')}
              </Link>
            </div>
          )}
          {activeTab === 'team' && <AccountOwnershipView />}
          {activeTab === 'openCore' && <OpenCorePortabilityPanel />}
          {activeTab === 'preferences' && (
            <>
              <SettingsAppearanceThemeSection />
              <SettingsJurisdictionPicker />
              <SettingsLocaleDangerSection />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
