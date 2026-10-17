'use client';

import React, { useState } from 'react';
import { Languages, AlertTriangle } from 'lucide-react';
import { cn } from '@/seed/utils/cn';

interface LocaleOption {
  id: 'vi' | 'en';
  label: string;
  flag: string;
}

const LOCALE_OPTIONS: LocaleOption[] = [
  { id: 'vi', label: 'Tiếng Việt (Vietnamese)', flag: '🇻🇳' },
  { id: 'en', label: 'English (US)', flag: '🇺🇸' },
];

export function SettingsLocaleDangerSection() {
  const [selectedLocale, setSelectedLocale] = useState<'vi' | 'en'>('en');

  return (
    <div className="space-y-6">
      {/* Locale & Language */}
      <section className="bg-card dark:bg-[#11131F] rounded-2xl p-6 shadow-sm border border-border dark:border-white/[0.08]">
        <h3 className="text-lg font-bold text-foreground dark:text-white mb-6 flex items-center gap-2">
          <Languages className="w-5 h-5 text-primary" />
          Language & Localization (i18n)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {LOCALE_OPTIONS.map((option) => {
            const isSelected = selectedLocale === option.id;
            return (
              <button
                key={option.id}
                onClick={() => setSelectedLocale(option.id)}
                className={cn(
                  'h-[50px] flex items-center justify-between px-4 rounded-xl transition-all',
                  isSelected
                    ? 'border-2 border-primary bg-primary/10'
                    : 'border border-border dark:border-white/[0.08] bg-background/60 dark:bg-[#090A10]/60 hover:bg-muted',
                )}
                role="radio"
                aria-checked={isSelected}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{option.flag}</span>
                  <span className="text-xs font-bold text-foreground dark:text-white">{option.label}</span>
                </div>
                <div
                  className={cn(
                    'w-4 h-4 rounded-full transition-all',
                    isSelected ? 'border-4 border-primary bg-white' : 'border-2 border-border dark:border-white/20',
                  )}
                />
              </button>
            );
          })}
        </div>
      </section>

      {/* Danger Zone */}
      <section className="bg-card dark:bg-[#11131F] rounded-2xl p-6 border-t-4 border-red-500/60 shadow-sm border border-border dark:border-white/[0.08]">
        <h3 className="text-lg font-bold text-destructive mb-2 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Danger Zone
        </h3>
        <p className="text-xs text-muted-foreground mb-6">
          Irreversible and destructive actions for your workspace and personal account.
        </p>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-red-500/20 bg-red-500/5">
          <div>
            <h4 className="text-sm font-bold text-foreground dark:text-white mb-1">Delete Account & Data</h4>
            <p className="text-xs text-muted-foreground">Permanently delete your account, pipelines, and stored credentials.</p>
          </div>
          <button
            onClick={() => {
              if (confirm('Are you absolutely sure you want to permanently delete your account?')) {
                alert('Account deletion initiated.');
              }
            }}
            className="border border-red-500 text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 active:scale-95"
          >
            Delete Account
          </button>
        </div>
      </section>
    </div>
  );
}
