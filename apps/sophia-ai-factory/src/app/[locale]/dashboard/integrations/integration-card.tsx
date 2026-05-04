/**
 * IntegrationCard — reusable card for the integrations index page.
 * Server-renderable (no client hooks), props-driven.
 */

import Link from 'next/link';
import { Card, CardContent } from '@/seed/components/ui/card';

// Namespace marker for i18n validator — do not remove
// getTranslations('dashboard.integrations')

export type IntegrationStatus = 'live' | 'beta' | 'coming_soon';

export interface IntegrationCardProps {
  name: string;
  icon: string;
  status: IntegrationStatus;
  isConnected: boolean;
  href: string;
  badge?: string;
  description?: string;
  /** Partial t function — pass the bound integrations namespace translator.
   *  Keys are scoped to dashboard.integrations.* namespace */
  t: (key: string) => string;
}

export function IntegrationCard({
  name, icon, status, isConnected, href, badge, description, t,
}: IntegrationCardProps) {
  const isSoon = status === 'coming_soon';
  const statusLabel = isSoon ? t('badge_soon') : status;
  const statusClass = isSoon
    ? 'bg-muted text-muted-foreground'
    : status === 'live'
    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';

  const actionLabel = isConnected
    ? t('btn_reconfigure')
    : isSoon
    ? t('badge_soon')
    : t('btn_connect');

  return (
    <Card className={isSoon ? 'opacity-60' : ''}>
      <CardContent className="p-4 flex items-start gap-3">
        <div className="flex-shrink-0 w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-lg">{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <span className="font-medium text-sm">{name}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${statusClass}`}>{statusLabel}</span>
            {badge && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">
                {badge}
              </span>
            )}
            {isConnected && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                {t('status_connected')}
              </span>
            )}
          </div>
          {description && (
            <p className="text-xs text-muted-foreground leading-snug">{description}</p>
          )}
          {!isConnected && !isSoon && !description && (
            <p className="text-xs text-muted-foreground">{t('status_not_connected')}</p>
          )}
        </div>
        <div className="flex-shrink-0">
          {isSoon ? (
            <button
              type="button"
              disabled
              aria-disabled="true"
              title="Coming soon / Sắp ra mắt"
              className="text-xs px-3 py-1.5 border rounded-md text-muted-foreground cursor-not-allowed opacity-60"
            >
              {t('badge_soon')}
            </button>
          ) : (
            <Link
              href={href}
              className="text-xs px-3 py-1.5 border rounded-md hover:bg-muted transition-colors whitespace-nowrap"
            >
              {actionLabel}
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
