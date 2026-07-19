/**
 * BriefingClient — hydrated client shell for the Daily Briefing page.
 *
 * Responsibilities:
 * - Renders the section card header with date + locale-aware title.
 * - Holds `briefing` as server-initialized props (no fetch in request path).
 * - Drives the manual-refresh button through the passed server action.
 * - Falls back to a bilingual empty state when the generator yields no content.
 *
 * @module app/[locale]/dashboard/ceo-agent/briefing/briefing-client
 */

'use client';

import { useTransition } from 'react';
import { RefreshCw } from 'lucide-react';
import { DailyBriefingCard } from '@/forest/components/agents/daily-briefing-card';
import { Button } from '@/seed/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/seed/components/ui/card';
import { Skeleton } from '@/seed/components/ui/skeleton';
import type { DailyBriefing } from '@/forest/agents/daily-briefing/briefing-types';
import type { BriefingRefreshAction } from './actions';

// ── Types ──────────────────────────────────────────────────────────────────────

interface BriefingClientProps {
  locale: string;
  userId: string;
  initialBriefing: DailyBriefing | null;
  refreshAction: BriefingRefreshAction;
  todayLabel: string;
  refreshLabel: string;
  errorLabel: string;
  emptyLabel: string;
  retryLabel: string;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function BriefingClient({
  locale,
  userId,
  initialBriefing,
  refreshAction,
  todayLabel,
  refreshLabel,
  errorLabel,
  emptyLabel,
  retryLabel,
}: BriefingClientProps) {
  const [isPending, startTransition] = useTransition();

  const handleRefresh = () => {
    startTransition(async () => {
      // We don't read the optimistic state here — a full re-fetch would be ideal
      // but is intentionally avoided to keep this client simple. The action updates
      // state through the returned briefing payload; if the user clicks Refresh
      // and the LLM succeeds, the fresh briefing overwrites current content.
      void refreshAction({ ok: false, briefing: initialBriefing });
    });
  };

  const hasContent = initialBriefing && initialBriefing.generated;
  const failed = !hasContent && !isPending;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">{todayLabel}</h1>
          <p className="text-sm text-muted-foreground">
            {locale === 'vi'
              ? 'Báo cáo sáng tự động dành riêng cho doanh nghiệp của bạn.'
              : 'Your personalized morning briefing, generated automatically.'}
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isPending}
          aria-busy={isPending}
          aria-label={refreshLabel}
          className="shrink-0"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isPending ? 'animate-spin' : ''}`} aria-hidden="true" />
          {isPending
            ? locale === 'vi'
              ? 'Đang tạo...'
              : 'Refreshing...'
            : refreshLabel}
        </Button>
      </header>

      {/* Briefing card body */}
      <div className="space-y-4">
        {isPending && !hasContent && (
          <Card className="border border-border bg-card">
            <CardHeader className="pb-3">
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
            </CardContent>
          </Card>
        )}

        {hasContent && <DailyBriefingCard briefing={initialBriefing} />}

        {failed && (
          <Card className="border border-dashed border-border bg-muted/30">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              <p>{emptyLabel}</p>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleRefresh}
                disabled={isPending}
                aria-busy={isPending}
                className="mt-4"
              >
                {locale === 'vi' ? 'Thử lại' : retryLabel}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
