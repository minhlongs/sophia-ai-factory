'use client';

/**
 * MasterWelcomeBanner — shown once to MASTER-tier users after free redemption.
 *
 * Visibility: tier === 'MASTER' AND localStorage.sophia.masterWelcomeDismissed !== 'v1'
 * Dismissible: sets localStorage key, banner disappears immediately.
 */

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { X, Zap, LayoutDashboard, Key, HeartHandshake } from 'lucide-react';

const STORAGE_KEY = 'sophia.masterWelcomeDismissed';
const STORAGE_VERSION = 'v1';

export function MasterWelcomeBanner() {
  const t = useTranslations('dashboard.masterWelcome');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (dismissed !== STORAGE_VERSION) {
        setVisible(true);
      }
    } catch {
      // localStorage unavailable (SSR guard or privacy mode) — skip banner
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, STORAGE_VERSION);
    } catch {
      // ignore
    }
    setVisible(false);
  }

  if (!visible) return null;

  const features = [
    { icon: Zap, key: 'affiliate' },
    { icon: LayoutDashboard, key: 'admin' },
    { icon: Key, key: 'api' },
    { icon: HeartHandshake, key: 'support' },
  ] as const;

  return (
    <div
      role="banner"
      className="relative rounded-xl border border-[var(--neon-cyan)]/30 bg-gradient-to-r from-[var(--neon-cyan)]/5 to-[var(--neon-purple)]/5 p-6"
    >
      {/* Dismiss button */}
      <button
        onClick={dismiss}
        aria-label={t('dismiss')}
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Header */}
      <div className="mb-4">
        <h2 className="text-lg font-bold text-foreground">{t('title')}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{t('subtitle')}</p>
      </div>

      {/* Feature grid */}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {features.map(({ icon: Icon, key }) => (
          <li
            key={key}
            className="flex items-center gap-2 rounded-lg bg-card border border-border px-3 py-2.5 text-sm text-foreground"
          >
            <Icon className="w-4 h-4 text-[var(--neon-cyan)] shrink-0" aria-hidden="true" />
            <span>{t(`feature.${key}`)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
