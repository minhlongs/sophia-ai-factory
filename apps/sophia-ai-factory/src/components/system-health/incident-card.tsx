'use client';

/**
 * Incident Card — Standardized CEO-safe Incident UX.
 * Implements 4 standard action zones across 5 classified categories.
 *
 * @module components/system-health/incident-card
 */

import React from 'react';
import {
  RefreshCw,
  MessageSquare,
  ArrowRight,
} from 'lucide-react';
import type { CustomerIncident } from '@/land/production-monitoring/customer-health-summary';
import {
  CATEGORY_META,
  type IncidentCategoryMetaItem,
} from './incident-category-meta';

export { CATEGORY_META, type IncidentCategoryMetaItem };

export interface IncidentCardProps {
  incident: CustomerIncident;
  locale?: 'vi' | 'en';
  onRetry?: (incidentId: string) => void | Promise<void>;
  onContactSupport?: (incident: CustomerIncident) => void;
  isRetrying?: boolean;
}

export function IncidentCard({
  incident,
  locale = 'vi',
  onRetry,
  onContactSupport,
  isRetrying = false,
}: IncidentCardProps) {
  const isVi = locale === 'vi';
  const meta = CATEGORY_META[incident.category] ?? CATEGORY_META.NETWORK_TIMEOUT;
  const CategoryIcon = meta.icon;

  const whatHappened = isVi ? incident.whatHappenedVi : incident.whatHappened;
  const whatItMeans = isVi ? incident.whatItMeansVi : incident.whatItMeans;
  const whatYouCanDo = isVi ? incident.whatYouCanDoVi : incident.whatYouCanDo;

  const handleRetry = () => {
    if (onRetry) {
      void onRetry(incident.id);
    } else if (incident.retryActionUrl && typeof window !== 'undefined') {
      window.location.href = incident.retryActionUrl;
    }
  };

  const handleSupport = () => {
    if (onContactSupport) {
      onContactSupport(incident);
    } else if (incident.supportUrl && typeof window !== 'undefined') {
      window.location.href = incident.supportUrl;
    }
  };

  return (
    <div
      className="rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md"
      data-testid={`incident-card-${incident.id}`}
      role="region"
      aria-label={isVi ? 'Thẻ thông báo sự cố' : 'Incident notification card'}
    >
      {/* Header: Service + Category Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <CategoryIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <span className="font-semibold text-foreground text-sm sm:text-base">
            {incident.service}
          </span>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.badgeCls}`}
        >
          {isVi ? meta.labelVi : meta.labelEn}
        </span>
      </div>

      {/* 3 Standard Action Zones */}
      <div className="mt-4 space-y-4 text-sm">
        <div className="rounded-lg bg-muted/40 p-3" data-testid="zone-what-happened">
          <p className="font-medium flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
            <span>📌</span> {isVi ? '1. Chuyện gì đã xảy ra' : '1. What Happened'}
          </p>
          <p className="mt-1 font-semibold text-foreground">{whatHappened}</p>
        </div>

        <div className="rounded-lg bg-muted/20 p-3" data-testid="zone-what-it-means">
          <p className="font-medium flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
            <span>💡</span> {isVi ? '2. Điều này có ý nghĩa gì' : '2. What It Means'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{whatItMeans}</p>
        </div>

        <div className="rounded-lg bg-primary/5 border border-primary/20 p-3" data-testid="zone-what-you-can-do">
          <p className="font-medium flex items-center gap-1.5 text-xs uppercase tracking-wider text-primary">
            <span>🛠️</span> {isVi ? '3. Bạn có thể làm gì' : '3. What You Can Do'}
          </p>
          <p className="mt-1 text-foreground/90 leading-relaxed">{whatYouCanDo}</p>
        </div>

        {/* Zones 4 & 5: Actions (TRY AGAIN & CONTACT SUPPORT) */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleRetry}
            disabled={isRetrying}
            data-testid="button-try-again"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRetrying ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>{isVi ? 'Thử lại' : 'Try Again'}</span>
          </button>

          <button
            type="button"
            onClick={handleSupport}
            data-testid="button-contact-support"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <span>{isVi ? 'Liên hệ hỗ trợ' : 'Contact Support'}</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
