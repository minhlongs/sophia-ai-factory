'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import type { SignupUser } from './admin-page-types';
import { TIER_BADGE_STYLES } from './admin-page-types';

export function AdminSignupsTable({ signups }: { signups: SignupUser[] }) {
  const t = useTranslations('stitch.admin');

  return (
    <section aria-label={t('aria.recentSignups')} className="bg-surface-container border border-outline-variant rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-on-surface">{t('users.title')}</h3>
        <button
          type="button"
          className="text-xs font-bold text-primary hover:underline transition-colors"
        >
          {t('users.viewAll')}
        </button>
      </div>

      <div className="overflow-hidden">
        <table className="w-full text-left">
          <caption className="sr-only">{t('aria.signupsTable')}</caption>
          <thead>
            <tr className="border-b border-outline-variant">
              <th scope="col" className="pb-3 text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                {t('users.headers.user')}
              </th>
              <th scope="col" className="pb-3 text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                {t('users.headers.tier')}
              </th>
              <th scope="col" className="pb-3 text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                {t('users.headers.date')}
              </th>
              <th scope="col" className="pb-3 text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                {t('users.headers.status')}
              </th>
            </tr>
          </thead>
          <tbody>
            {signups.map((user) => (
              <tr key={user.id} className="border-b border-outline-variant last:border-0">
                <td className="py-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      {user.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element -- user avatar
                        <img
                          src={user.avatar}
                          alt={user.avatarAlt ?? user.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                          {user.initials}
                        </div>
                      )}
                      <span
                        className={`absolute top-2 right-2 w-2 h-2 bg-error rounded-full`}
                        aria-hidden="true"
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-on-surface">{user.name}</p>
                      <p className="text-xs text-on-surface-variant">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${TIER_BADGE_STYLES[user.tier] ?? ''}`}>
                    {user.tier}
                  </span>
                </td>
                <td className="py-3 text-xs text-on-surface-variant">{user.signupDate}</td>
                <td className="py-3">
                  <span
                    className={
                      user.status === 'active' ? 'text-emerald-500' : 'text-error'
                    }
                  >
                    {user.status === 'active' ? '● Active' : '● Suspended'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
