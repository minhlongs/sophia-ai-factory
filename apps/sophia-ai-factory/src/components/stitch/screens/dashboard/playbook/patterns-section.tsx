// i18n-namespace: dashboard.playbook
import React from 'react';
import { Card, CardContent, CardHeader, Badge, Table } from '@/components/stitch';
import { TrendingUp } from 'lucide-react';
import type { PlaybookPattern } from '@/seed/types/playbook-pattern';
import type { PlaybookTranslation } from './types';
import { LEVEL_COLOR, EmptyState } from './empty-state';
import { PatternsSummaryGrid } from './patterns-summary-cards';

interface PatternsSectionProps {
  patterns: PlaybookPattern[];
  t: PlaybookTranslation;
}

export function PatternsSection({ patterns, t }: PatternsSectionProps) {
  const hookPatterns = patterns.filter(
    (p) => p.featureKey === 'hook_style' || p.featureKey === 'hook_type',
  );
  const voicePatterns = patterns.filter(
    (p) => p.featureKey === 'voice_style' || p.featureKey === 'voice_profile',
  );
  const durationPatterns = patterns.filter(
    (p) => p.featureKey === 'duration' || p.featureKey === 'duration_pattern',
  );

  if (patterns.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyState
            icon={<TrendingUp className="h-10 w-10 text-muted-foreground" />}
            title={t('empty')}
            description={t('noData')}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PatternsSummaryGrid
        hookPatterns={hookPatterns}
        voicePatterns={voicePatterns}
        durationPatterns={durationPatterns}
        t={t}
      />

      <Card>
        <CardHeader>
          <h3 className="text-base font-semibold">{t('tabs.patterns')}</h3>
        </CardHeader>
        <CardContent>
          <Table
            variant="embedded"
            data={patterns}
            columns={[
              {
                key: 'feature',
                header: 'Feature',
                cell: (p) => (
                  <div className="flex flex-col">
                    <span className="font-mono font-semibold text-sm">{p.featureValue}</span>
                    <span className="text-xs text-muted-foreground">{p.featureKey}</span>
                  </div>
                ),
              },
              {
                key: 'metric',
                header: 'Metric',
                cell: (p) => (
                  <div className="text-sm">
                    <span className="font-medium">{p.metric.toUpperCase()}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {(p.avgMetric * 100).toFixed(1)}%
                    </span>
                  </div>
                ),
              },
              {
                key: 'confidence',
                header: t('confidence'),
                cell: (p) => (
                  <Badge className={LEVEL_COLOR[p.confidenceLevel]}>
                    {t(p.confidenceLevel)} ({Math.round(p.confidence * 100)}%)
                  </Badge>
                ),
              },
              {
                key: 'sample',
                header: t('sample'),
                cell: (p) => <span className="text-sm">{p.sampleSize}</span>,
              },
              {
                key: 'detected',
                header: t('detectedAt'),
                cell: (p) => (
                  <span className="text-xs text-muted-foreground">
                    {p.detectedAt > 0 ? new Date(p.detectedAt).toLocaleDateString() : '—'}
                  </span>
                ),
              },
            ]}
            getRowId={(p) => p.id}
          />
        </CardContent>
      </Card>
    </div>
  );
}
