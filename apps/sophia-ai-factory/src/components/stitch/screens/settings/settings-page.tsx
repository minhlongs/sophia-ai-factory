'use client';

import React, { useState } from 'react';
import {
  User,
  Key,
  CreditCard,
  Bell,
  Users,
  Palette,
  LogOut,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  Upload,
  CheckCircle,
  AlertTriangle,
  Languages,
  Settings,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/seed/utils/cn';
import { Input } from '@/seed/components/ui/input';

/* -- Types ----------------------------------------------------------------- */

interface NavItem {
  id: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface ApiKeyItem {
  id: string;
  nameKey: string;
  configured: boolean;
  maskedKey: string;
}

interface LocaleOption {
  id: 'vi' | 'en';
  labelKey: string;
  flag: string;
}

/* -- Props ----------------------------------------------------------------- */

interface SettingsPageProps {
  /** Server-fetched user display name */
  userName?: string;
  /** Server-fetched user email */
  userEmail?: string;
  /** Resolved tier (BASIC | PREMIUM | ENTERPRISE | MASTER) */
  currentTier?: string;
  /** Subscription period end timestamp (ISO string or null) */
  periodEnd?: string | null;
  /** Completed order count */
  completedOrderCount?: number;
}

/* -- Constants ------------------------------------------------------------- */

const NAV_ITEMS: NavItem[] = [
  { id: 'account', labelKey: 'nav.account', icon: User },
  { id: 'apiKeys', labelKey: 'nav.apiKeys', icon: Key },
  { id: 'billing', labelKey: 'nav.billing', icon: CreditCard },
  { id: 'notifications', labelKey: 'nav.notifications', icon: Bell },
  { id: 'team', labelKey: 'nav.team', icon: Users },
  { id: 'appearance', labelKey: 'nav.appearance', icon: Palette },
];

const API_KEYS: ApiKeyItem[] = [
  { id: 'elevenlabs', nameKey: 'apiKeys.elevenLabs', configured: true, maskedKey: 'sk_live_1234567890abcdef' },
  { id: 'openrouter', nameKey: 'apiKeys.openRouter', configured: true, maskedKey: 'sk_or_0987654321fedcba' },
  { id: 'did', nameKey: 'apiKeys.did', configured: false, maskedKey: '' },
];

const LOCALE_OPTIONS: LocaleOption[] = [
  { id: 'vi', labelKey: 'locale.vietnamese', flag: '🇻🇳' },
  { id: 'en', labelKey: 'locale.english', flag: '🇺🇸' },
];

/* ==========================================================================
   SettingsPage
   ========================================================================== */

export default function SettingsPage({
  userName: propUserName,
  userEmail: propUserEmail,
  currentTier: propCurrentTier, // eslint-disable-line @typescript-eslint/no-unused-vars
}: SettingsPageProps = {}) {
  const t = useTranslations('stitch.settingsPage');
  const [activeNav, setActiveNav] = useState('account');
  const [selectedLocale, setSelectedLocale] = useState<'vi' | 'en'>('en');
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [userName, setUserName] = useState(propUserName ?? '');
  const [userEmail] = useState(propUserEmail ?? '');

  const toggleKeyVisibility = (id: string) => {
    setVisibleKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-background text-on-surface">
      {/* ===== Top NavBar ==================================================== */}
      <header className="bg-surface-container-low flex items-center justify-between px-6 py-3 w-full border-b border-outline-variant shadow-sm z-50 shrink-0">
        <div className="flex items-center gap-8">
          <span className="text-xl font-black text-primary tracking-tighter">
            Sophia AI Factory
          </span>
          <nav className="hidden md:flex gap-6 items-center" aria-label="Main navigation">
            {['Projects', 'Assets', 'Templates', 'Community'].map((label) => (
              <a
                key={label}
                href="#"
                className="text-on-surface-variant text-sm font-medium hover:text-primary transition-colors"
              >
                {label}
              </a>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <button className="bg-primary hover:bg-primary/90 text-white font-bold px-4 py-1.5 rounded-lg text-sm scale-95 active:opacity-80 transition-all shadow-lg shadow-primary/20">
            {t('topNav.upgradePlan')}
          </button>
          <button
            className="text-on-surface-variant hover:text-primary transition-colors p-1"
            aria-label={t('topNav.notifications')}
          >
            <Bell className="w-5 h-5" />
          </button>
          <Settings className="w-5 h-5 text-primary" aria-hidden="true" />
          <div className="w-8 h-8 rounded-full bg-surface-container-highest overflow-hidden border border-outline-variant">
            <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
              {userName ? userName.charAt(0).toUpperCase() : '?'}
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ===== Sidebar ===================================================== */}
        <aside
          className="w-[200px] bg-surface-container-low border-r border-outline-variant flex flex-col pt-6 shrink-0"
          aria-label={t('nav.label')}
        >
          <div className="px-4 mb-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant opacity-60 px-4 mb-2">
              {t('nav.title')}
            </h2>
          </div>
          <nav className="flex flex-col gap-1 flex-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveNav(item.id)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all text-left group',
                    isActive
                      ? 'sidebar-active text-primary border-l-[3px] border-primary bg-gradient-to-r from-primary/10 to-transparent'
                      : 'text-on-surface-variant hover:bg-surface-variant',
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className={cn(
                    'w-5 h-5 flex-shrink-0 transition-colors',
                    isActive ? 'text-primary' : 'group-hover:text-primary',
                  )} aria-hidden="true" />
                  <span>{t(item.labelKey)}</span>
                </button>
              );
            })}
          </nav>
          <div className="mt-auto p-4 border-t border-outline-variant/30">
            <button className="flex items-center gap-3 text-on-surface-variant text-sm w-full hover:text-error transition-colors">
              <LogOut className="w-5 h-5" aria-hidden="true" />
              <span>{t('nav.signOut')}</span>
            </button>
          </div>
        </aside>

        {/* ===== Main Content ================================================ */}
        <main className="flex-1 overflow-y-auto p-10 bg-background custom-scrollbar"
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#484750 transparent' }}
        >
          <div className="max-w-4xl mx-auto">
            <h1 className="text-[28px] font-bold text-on-surface mb-8 tracking-tight">
              {t('pageTitle')}
            </h1>

            <div className="space-y-8 pb-20">
              {/* Section 1: Profile Details */}
              <section className="bg-[#18181B] rounded-xl p-6 shadow-xl border border-outline-variant/20">
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" aria-hidden="true" />
                  {t('profile.title')}
                </h3>
                <div className="flex flex-col md:flex-row gap-10">
                  {/* Avatar Upload */}
                  <div className="relative group cursor-pointer w-24 h-24">
                    <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-primary/30 group-hover:border-primary transition-all bg-primary/20 flex items-center justify-center text-primary font-bold text-xl">
                      {userName ? userName.charAt(0).toUpperCase() : '?'}
                    </div>
                    <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Upload className="w-5 h-5 text-white" aria-hidden="true" />
                    </div>
                  </div>

                  {/* Form Fields */}
                  <div className="flex-1 grid grid-cols-1 gap-6">
                    <div>
                      <label htmlFor="profile-name" className="block text-sm font-medium text-on-surface-variant mb-2">
                        {t('profile.name')}
                      </label>
                      <Input
                        id="profile-name"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        className="bg-surface-container-highest border-outline-variant focus:ring-2 focus:ring-primary/40 focus:border-primary"
                      />
                    </div>
                    <div>
                      <label htmlFor="profile-email" className="block text-sm font-medium text-on-surface-variant mb-2">
                        {t('profile.email')}
                      </label>
                      <div className="relative">
                        <Input
                          id="profile-email"
                          type="email"
                          value={userEmail}
                          disabled
                          className="bg-surface-container-low border-outline-variant/30 text-on-surface-variant/50 cursor-not-allowed"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border border-green-500/20">
                          <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" />
                          {t('profile.verified')}
                        </div>
                      </div>
                    </div>
                    <div className="pt-2">
                      <button className="bg-primary hover:bg-primary/90 text-white font-semibold px-6 py-2.5 rounded-lg transition-all shadow-lg shadow-primary/20 active:scale-95">
                        {t('profile.save')}
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 2: API Keys */}
              <section className="bg-[#18181B] rounded-xl p-6 shadow-xl border border-outline-variant/20">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Key className="w-5 h-5 text-primary" aria-hidden="true" />
                    {t('apiKeys.title')}
                  </h3>
                  <button className="text-primary hover:bg-primary/10 border border-primary/30 px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2">
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    {t('apiKeys.addKey')}
                  </button>
                </div>
                <div className="space-y-4">
                  {API_KEYS.map((apiKey) => {
                    const isVisible = visibleKeys[apiKey.id];
                    return (
                      <div
                        key={apiKey.id}
                        className="flex items-center justify-between p-4 bg-surface-container-highest/50 rounded-xl border border-outline-variant/30"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-bold text-on-surface">
                              {t(apiKey.nameKey)}
                            </span>
                            {apiKey.configured ? (
                              <>
                                <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                                <span className="text-[10px] text-green-500 font-bold uppercase tracking-tighter">
                                  {t('apiKeys.configured')}
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                                <span className="text-[10px] text-red-500 font-bold uppercase tracking-tighter">
                                  {t('apiKeys.missing')}
                                </span>
                              </>
                            )}
                          </div>
                          {apiKey.configured ? (
                            <div className="flex items-center gap-2 max-w-md">
                              <input
                                type={isVisible ? 'text' : 'password'}
                                readOnly
                                value={apiKey.maskedKey}
                                className="bg-transparent border-none p-0 text-sm font-mono text-on-surface-variant flex-1 focus:ring-0 focus:outline-none"
                                aria-label={t(apiKey.nameKey)}
                              />
                              <button
                                onClick={() => toggleKeyVisibility(apiKey.id)}
                                className="text-on-surface-variant hover:text-on-surface transition-colors"
                                aria-label={isVisible ? t('apiKeys.hide') : t('apiKeys.show')}
                              >
                                {isVisible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                              </button>
                            </div>
                          ) : (
                            <p className="text-xs text-on-surface-variant italic">
                              {t('apiKeys.didHint')}
                            </p>
                          )}
                        </div>
                        {apiKey.configured ? (
                          <button
                            className="p-2 hover:bg-surface-variant rounded-lg transition-colors"
                            aria-label={t('apiKeys.delete')}
                          >
                            <Trash2 className="w-5 h-5 text-on-surface-variant" aria-hidden="true" />
                          </button>
                        ) : (
                          <button className="text-xs font-bold text-primary hover:underline px-4">
                            {t('apiKeys.connect')}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Section 3: Locale & Language */}
              <section className="bg-[#18181B] rounded-xl p-6 shadow-xl border border-outline-variant/20">
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <Languages className="w-5 h-5 text-primary" aria-hidden="true" />
                  {t('locale.title')}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {LOCALE_OPTIONS.map((option) => {
                    const isSelected = selectedLocale === option.id;
                    return (
                      <button
                        key={option.id}
                        onClick={() => setSelectedLocale(option.id)}
                        className={cn(
                          'h-[44px] flex items-center justify-between px-4 rounded-xl transition-all',
                          isSelected
                            ? 'border-2 border-primary bg-primary/10'
                            : 'border border-outline-variant/30 hover:bg-surface-variant/50',
                        )}
                        role="radio"
                        aria-checked={isSelected}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl" aria-hidden="true">{option.flag}</span>
                          <span className="text-sm font-medium">{t(option.labelKey)}</span>
                        </div>
                        <div
                          className={cn(
                            'w-4 h-4 rounded-full transition-all',
                            isSelected
                              ? 'border-4 border-primary bg-white'
                              : 'border-2 border-outline-variant',
                          )}
                          aria-hidden="true"
                        />
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Section 4: Danger Zone */}
              <section className="bg-[#18181B] rounded-xl p-6 border-t-4 border-red-500/50 bg-red-500/5 shadow-xl">
                <h3 className="text-lg font-semibold text-error mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" aria-hidden="true" />
                  {t('dangerZone.title')}
                </h3>
                <p className="text-[13px] text-on-surface-variant mb-6">
                  {t('dangerZone.description')}
                </p>
                <div className="flex items-center justify-between p-4 rounded-xl border border-red-500/20 bg-red-500/5">
                  <div>
                    <h4 className="text-sm font-bold text-on-surface mb-1">
                      {t('dangerZone.deleteAccount')}
                    </h4>
                    <p className="text-[13px] text-on-surface-variant">
                      {t('dangerZone.deleteDesc')}
                    </p>
                    <p className="text-[11px] text-on-surface-variant/60 font-medium mt-1">
                      {t('dangerZone.irreversible')}
                    </p>
                  </div>
                  <button className="border border-red-500 text-red-500 hover:bg-red-500 hover:text-white px-6 py-2 rounded-lg text-sm font-bold transition-all active:scale-95">
                    {t('dangerZone.deleteButton')}
                  </button>
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
