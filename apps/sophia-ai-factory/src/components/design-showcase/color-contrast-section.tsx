'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Check, CheckCircle2, Copy, ShieldCheck, XCircle } from 'lucide-react';
import type { WcagContrastAuditRow, ZenThemeMode } from '@/seed/design-tokens';
import { Badge } from '@/seed/components/ui/badge';
import { Button } from '@/seed/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/seed/components/ui/card';
import {
  getContrastAuditByMode,
  getSemanticTokenEntries,
  getTonalPaletteGroups,
  type SemanticTokenEntry,
  type TonalPaletteGroup,
} from './token-catalog';

export interface ColorContrastSectionProps {
  activeThemeMode: ZenThemeMode;
  onCopy: (value: string, label: string) => void;
  copiedKey: string | null;
}

function SemanticTokensCard({
  resolvedMode,
  semanticTokens,
  onCopy,
  copiedKey,
}: {
  resolvedMode: ZenThemeMode;
  semanticTokens: SemanticTokenEntry[];
  onCopy: (value: string, label: string) => void;
  copiedKey: string | null;
}) {
  const t = useTranslations('designShowcase');

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>{t('colors.semanticTitle')}</CardTitle>
            <CardDescription>{t('colors.semanticSubtitle')}</CardDescription>
          </div>
          <Badge variant="outline">
            {resolvedMode === 'dark' ? t('theme.darkName') : t('theme.lightName')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {semanticTokens.map((token) => {
            const swatchValue = resolvedMode === 'dark' ? token.darkValue : token.lightValue;
            const copyId = `semantic-${resolvedMode}-${token.role}`;
            const isCopied = copiedKey === copyId;

            return (
              <button
                key={token.role}
                type="button"
                onClick={() => onCopy(`var(${token.cssVar})`, copyId)}
                className="group flex items-center gap-3 rounded-xl border border-border bg-background/60 p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`${t('actions.copy')} ${token.cssVar} (${swatchValue})`}
              >
                <span
                  className="h-10 w-10 shrink-0 rounded-lg border border-border shadow-inner"
                  style={{ backgroundColor: swatchValue }}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-xs font-medium text-foreground">
                    {token.role}
                  </span>
                  <span className="block truncate font-mono text-[11px] text-muted-foreground">
                    {swatchValue}
                  </span>
                </span>
                <span className="shrink-0 text-muted-foreground transition-colors group-hover:text-foreground">
                  {isCopied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function TonalPalettesCard({
  tonalGroups,
  onCopy,
  copiedKey,
}: {
  tonalGroups: TonalPaletteGroup[];
  onCopy: (value: string, label: string) => void;
  copiedKey: string | null;
}) {
  const t = useTranslations('designShowcase');

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('colors.tonalTitle')}</CardTitle>
        <CardDescription>{t('colors.tonalSubtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {tonalGroups.map((group) => (
          <div key={group.family} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.family}
              </span>
              <span className="text-xs text-muted-foreground">
                {group.swatches.length} {t('colors.tonesLabel')}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
              {group.swatches.map((swatch) => {
                const copyId = `tonal-${group.family}-${swatch.tone}`;
                const isCopied = copiedKey === copyId;

                return (
                  <button
                    key={swatch.tokenPath}
                    type="button"
                    onClick={() => onCopy(swatch.value, copyId)}
                    title={swatch.description}
                    className="group overflow-hidden rounded-lg border border-border bg-card text-left transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div
                      className="h-10 w-full border-b border-border/60"
                      style={{ backgroundColor: swatch.value }}
                      aria-hidden="true"
                    />
                    <div className="flex items-center justify-between px-2 py-1.5">
                      <div className="min-w-0">
                        <div className="font-mono text-[11px] font-semibold text-foreground">
                          {swatch.tone}
                        </div>
                        <div className="truncate font-mono text-[10px] text-muted-foreground">
                          {swatch.value}
                        </div>
                      </div>
                      {isCopied && (
                        <Check className="h-3 w-3 shrink-0 text-emerald-500" aria-hidden="true" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function WcagContrastCard({ contrastRows }: { contrastRows: WcagContrastAuditRow[] }) {
  const t = useTranslations('designShowcase');
  const passingCount = contrastRows.filter((row) => row.passes).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-500" aria-hidden="true" />
              <span>{t('colors.wcagTitle')}</span>
            </CardTitle>
            <CardDescription>{t('colors.wcagSubtitle')}</CardDescription>
          </div>
          <Badge variant="enterprise" data-testid="wcag-pass-summary">
            {passingCount}/{contrastRows.length} {t('colors.wcagPassed')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-2.5 pr-4 font-medium">{t('colors.table.pair')}</th>
                <th className="py-2.5 pr-4 font-medium">{t('colors.table.sample')}</th>
                <th className="py-2.5 pr-4 font-medium">{t('colors.table.ratio')}</th>
                <th className="py-2.5 pr-4 font-medium">{t('colors.table.min')}</th>
                <th className="py-2.5 font-medium">{t('colors.table.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {contrastRows.map((row) => (
                <tr key={`${row.mode}-${row.pair}`} className="align-middle">
                  <td className="py-2.5 pr-4 font-mono text-xs text-foreground">{row.pair}</td>
                  <td className="py-2.5 pr-4">
                    <span
                      className="inline-flex items-center gap-2 rounded-md border border-border px-2.5 py-1 font-mono text-xs font-medium"
                      style={{ color: row.foreground, backgroundColor: row.background }}
                    >
                      Aa {row.foreground}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 font-mono text-xs font-semibold tabular-nums text-foreground">
                    {row.ratio.toFixed(2)}:1
                  </td>
                  <td className="py-2.5 pr-4 font-mono text-xs tabular-nums text-muted-foreground">
                    {row.minRequired.toFixed(1)}:1
                  </td>
                  <td className="py-2.5">
                    {row.passes ? (
                      <span className="inline-flex items-center gap-1 font-mono text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        {t('colors.wcagPassBadge')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-mono text-xs font-medium text-destructive">
                        <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        {t('colors.wcagFailBadge')}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export function ColorContrastSection({
  activeThemeMode,
  onCopy,
  copiedKey,
}: ColorContrastSectionProps) {
  const t = useTranslations('designShowcase');
  const [inspectMode, setInspectMode] = React.useState<ZenThemeMode | 'sync'>('sync');

  const resolvedMode: ZenThemeMode = inspectMode === 'sync' ? activeThemeMode : inspectMode;
  const semanticTokens = React.useMemo(() => getSemanticTokenEntries(), []);
  const tonalGroups = React.useMemo(() => getTonalPaletteGroups(), []);
  const contrastRows = React.useMemo(() => getContrastAuditByMode(resolvedMode), [resolvedMode]);

  return (
    <section
      id="colors"
      aria-labelledby="design-colors-heading"
      className="scroll-mt-24 space-y-8"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <Badge variant="basic">{t('colors.eyebrow')}</Badge>
          <h2
            id="design-colors-heading"
            className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
          >
            {t('colors.title')}
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
            {t('colors.description')}
          </p>
        </div>

        <div
          role="group"
          aria-label={t('colors.inspectModeLabel')}
          className="inline-flex items-center gap-1 rounded-xl border border-border bg-card p-1"
        >
          {(['sync', 'dark', 'light'] as const).map((option) => (
            <Button
              key={option}
              type="button"
              size="sm"
              variant={inspectMode === option ? 'primary' : 'ghost'}
              onClick={() => setInspectMode(option)}
              aria-pressed={inspectMode === option}
            >
              {t(`colors.mode.${option}`)}
            </Button>
          ))}
        </div>
      </div>

      <SemanticTokensCard
        resolvedMode={resolvedMode}
        semanticTokens={semanticTokens}
        onCopy={onCopy}
        copiedKey={copiedKey}
      />

      <TonalPalettesCard tonalGroups={tonalGroups} onCopy={onCopy} copiedKey={copiedKey} />

      <WcagContrastCard contrastRows={contrastRows} />
    </section>
  );
}
