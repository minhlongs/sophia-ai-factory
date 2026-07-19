/**
 * Client component for Publish History page.
 * Renders a filterable, paginated table of publish events with CSV export.
 */

'use client';

import { useState, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';

export interface HistoryEvent {
  id: number;
  provider: string;
  content_title: string;
  scheduled_at: number;
  published_at: number | null;
  status: string;
  views: number;
  likes: number;
  shares: number;
  error_message: string | null;
}

const ITEMS_PER_PAGE = 20;

const STATUS_STYLES: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  published: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  cancelled: 'bg-muted text-muted-foreground',
};

export default function HistoryClient({
  userId,
  initialEvents = [],
}: {
  userId: string;
  initialEvents: HistoryEvent[];
}) {
  const t = useTranslations('socialPages.history');
  const [search, setSearch] = useState('');
  const [filterChannel, setFilterChannel] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [page, setPage] = useState(0);

  const channels = useMemo(() => {
    const set = new Set(initialEvents.map((e) => e.provider));
    return Array.from(set).sort();
  }, [initialEvents]);

  const statuses = ['scheduled', 'published', 'failed', 'cancelled'];

  const filtered = useMemo(() => {
    return initialEvents.filter((ev) => {
      if (search && !ev.content_title.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (filterChannel !== 'all' && ev.provider !== filterChannel) {
        return false;
      }
      if (filterStatus !== 'all' && ev.status !== filterStatus) {
        return false;
      }
      return true;
    });
  }, [initialEvents, search, filterChannel, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(safePage * ITEMS_PER_PAGE, (safePage + 1) * ITEMS_PER_PAGE);

  const exportCsv = useCallback(() => {
    const headers = [
      t('tableHeaders.content'),
      t('tableHeaders.channel'),
      t('tableHeaders.scheduledAt'),
      t('tableHeaders.publishedAt'),
      t('tableHeaders.status'),
      t('tableHeaders.views'),
      t('tableHeaders.likes'),
      t('tableHeaders.shares'),
    ];
    const rows = filtered.map((ev) => [
      `"${ev.content_title.replace(/"/g, '""')}"`,
      ev.provider,
      new Date(ev.scheduled_at * 1000).toISOString(),
      ev.published_at ? new Date(ev.published_at * 1000).toISOString() : '',
      ev.status,
      String(ev.views),
      String(ev.likes),
      String(ev.shares),
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `publish-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered, t]);

  const formatDate = (ts: number | null): string => {
    if (!ts) return '—';
    return new Date(ts * 1000).toLocaleDateString('vi-VN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="text-xs px-3 py-2 border border-border rounded-lg hover:bg-muted transition-colors whitespace-nowrap"
        >
          {t('exportCsv')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="search"
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          className="flex-1 text-sm px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground"
        />
        <select
          value={filterChannel}
          onChange={(e) => {
            setFilterChannel(e.target.value);
            setPage(0);
          }}
          className="text-sm px-3 py-2 border border-border rounded-lg bg-background text-foreground"
        >
          <option value="all">{t('all')}</option>
          {channels.map((ch) => (
            <option key={ch} value={ch}>
              {ch.toUpperCase()}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value);
            setPage(0);
          }}
          className="text-sm px-3 py-2 border border-border rounded-lg bg-background text-foreground"
        >
          <option value="all">{t('all')}</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {t(s)}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  {t('tableHeaders.content')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  {t('tableHeaders.channel')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  {t('tableHeaders.scheduledAt')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  {t('tableHeaders.publishedAt')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  {t('tableHeaders.status')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                  {t('tableHeaders.views')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                  {t('tableHeaders.likes')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                  {t('tableHeaders.shares')}
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    {t('noResults')}
                  </td>
                </tr>
              ) : (
                paged.map((ev) => (
                  <tr key={ev.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm text-foreground font-medium">
                      {ev.content_title}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {ev.provider.toUpperCase()}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDate(ev.scheduled_at)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDate(ev.published_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[ev.status] ?? ''}`}
                      >
                        {t(ev.status) ?? ev.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-foreground">
                      {ev.views.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-foreground">
                      {ev.likes.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-foreground">
                      {ev.shares.toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {t('pagination.showing', {
              from: safePage * ITEMS_PER_PAGE + 1,
              to: Math.min((safePage + 1) * ITEMS_PER_PAGE, filtered.length),
              total: filtered.length,
            })}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="px-3 py-1 border border-border rounded-lg disabled:opacity-40 hover:bg-muted transition-colors"
            >
              {t('pagination.previous')}
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              className="px-3 py-1 border border-border rounded-lg disabled:opacity-40 hover:bg-muted transition-colors"
            >
              {t('pagination.next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
