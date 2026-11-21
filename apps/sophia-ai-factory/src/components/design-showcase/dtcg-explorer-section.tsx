'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Check, Code2, Copy, Download, Search } from 'lucide-react';
import type { ZenThemeMode } from '@/seed/design-tokens';
import { Badge } from '@/seed/components/ui/badge';
import { Button } from '@/seed/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/seed/components/ui/card';
import { Input } from '@/seed/components/ui/input';
import {
  buildCssVariablesExport,
  buildFlatDtcgRows,
  serializeDtcgJson,
  type DtcgCategory,
  type FlatDtcgTokenRow,
} from './token-catalog';

export interface DtcgExplorerSectionProps {
  activeThemeMode: ZenThemeMode;
  onCopy: (value: string, label: string) => void;
  onDownloadDtcg: () => void;
  copiedKey: string | null;
}

type CategoryFilter = 'all' | DtcgCategory;

const CATEGORY_OPTIONS: readonly CategoryFilter[] = [
  'all',
  'semantic-dark',
  'semantic-light',
  'tonal',
  'typography',
  'motion',
];

function DtcgTokenTable({
  rows,
  copiedKey,
  onCopy,
}: {
  rows: FlatDtcgTokenRow[];
  copiedKey: string | null;
  onCopy: (value: string, label: string) => void;
}) {
  const t = useTranslations('designShowcase');

  if (rows.length === 0) {
    return (
      <p
        data-testid="dtcg-empty-state"
        className="py-10 text-center text-sm text-muted-foreground"
      >
        {t('dtcg.emptyState')}
      </p>
    );
  }

  return (
    <div className="max-h-[480px] overflow-auto">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-card">
          <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
            <th className="py-2.5 pr-4 font-medium">{t('dtcg.columns.token')}</th>
            <th className="py-2.5 pr-4 font-medium">{t('dtcg.columns.type')}</th>
            <th className="py-2.5 pr-4 font-medium">{t('dtcg.columns.value')}</th>
            <th className="py-2.5 pr-4 font-medium">{t('dtcg.columns.cssVar')}</th>
            <th className="py-2.5 text-right font-medium">{t('dtcg.columns.copy')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70">
          {rows.map((row) => {
            const copyTarget = row.cssVar ? `var(${row.cssVar})` : row.value;
            const isCopied = copiedKey === row.id;

            return (
              <tr key={row.id} className="align-middle hover:bg-muted/40">
                <td className="py-2.5 pr-4">
                  <div className="font-mono text-xs font-medium text-foreground">{row.path}</div>
                  <div className="text-[11px] text-muted-foreground">{row.description}</div>
                </td>
                <td className="py-2.5 pr-4">
                  <Badge variant="outline">{row.type}</Badge>
                </td>
                <td className="py-2.5 pr-4">
                  <span className="inline-flex items-center gap-2 font-mono text-xs text-foreground">
                    {row.isColor && (
                      <span
                        className="inline-block h-3.5 w-3.5 shrink-0 rounded border border-border"
                        style={{ backgroundColor: row.value }}
                        aria-hidden="true"
                      />
                    )}
                    <span className="max-w-[220px] truncate">{row.value}</span>
                  </span>
                </td>
                <td className="py-2.5 pr-4 font-mono text-xs text-muted-foreground">
                  {row.cssVar ?? '—'}
                </td>
                <td className="py-2.5 text-right">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => onCopy(copyTarget, row.id)}
                    aria-label={`${t('actions.copy')} ${row.path}`}
                  >
                    {isCopied ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function DtcgExplorerSection({
  activeThemeMode,
  onCopy,
  onDownloadDtcg,
  copiedKey,
}: DtcgExplorerSectionProps) {
  const t = useTranslations('designShowcase');
  const [query, setQuery] = React.useState('');
  const [category, setCategory] = React.useState<CategoryFilter>('all');

  const allRows = React.useMemo(() => buildFlatDtcgRows(), []);

  const filteredRows = React.useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return allRows.filter((row) => {
      if (category !== 'all' && row.category !== category) {
        return false;
      }
      if (!normalized) {
        return true;
      }
      return (
        row.path.toLowerCase().includes(normalized) ||
        row.value.toLowerCase().includes(normalized) ||
        (row.cssVar?.toLowerCase().includes(normalized) ?? false) ||
        row.description.toLowerCase().includes(normalized)
      );
    });
  }, [allRows, category, query]);

  return (
    <section
      id="dtcg-explorer"
      aria-labelledby="design-dtcg-heading"
      className="scroll-mt-24 space-y-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <Badge variant="premium">{t('dtcg.eyebrow')}</Badge>
          <h2
            id="design-dtcg-heading"
            className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
          >
            {t('dtcg.title')}
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
            {t('dtcg.description')}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onCopy(buildCssVariablesExport(activeThemeMode), 'dtcg-css')}
            data-testid="copy-css-vars-button"
            className="gap-1.5"
          >
            {copiedKey === 'dtcg-css' ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
            ) : (
              <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>{t('actions.copyCssVars')}</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onCopy(serializeDtcgJson(), 'dtcg-json')}
            data-testid="copy-dtcg-json-button"
            className="gap-1.5"
          >
            {copiedKey === 'dtcg-json' ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>{t('actions.copyDtcgJson')}</span>
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={onDownloadDtcg}
            data-testid="download-dtcg-json-button"
            className="gap-1.5"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t('actions.downloadDtcgJson')}</span>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>{t('dtcg.tableTitle')}</CardTitle>
              <CardDescription data-testid="dtcg-match-count">
                {t('dtcg.showingCount', { shown: filteredRows.length, total: allRows.length })}
              </CardDescription>
            </div>

            <div className="relative w-full sm:max-w-xs">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('dtcg.searchPlaceholder')}
                aria-label={t('dtcg.searchPlaceholder')}
                data-testid="dtcg-search-input"
                className="pl-9"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('dtcg.filterLabel')}>
            {CATEGORY_OPTIONS.map((option) => (
              <Button
                key={option}
                type="button"
                size="sm"
                variant={category === option ? 'primary' : 'outline'}
                onClick={() => setCategory(option)}
                aria-pressed={category === option}
              >
                {t(`dtcg.categories.${option}`)}
              </Button>
            ))}
          </div>
        </CardHeader>

        <CardContent>
          <DtcgTokenTable rows={filteredRows} copiedKey={copiedKey} onCopy={onCopy} />
        </CardContent>
      </Card>
    </section>
  );
}
