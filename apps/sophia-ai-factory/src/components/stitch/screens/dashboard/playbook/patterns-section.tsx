// i18n-namespace: dashboard.playbook
import React from 'react';
import { Card, CardContent, CardHeader, Badge, Table } from '@/components/stitch';
import { TrendingUp, Film, Mic, Clock } from 'lucide-react';
import type { PlaybookPattern } from '@/seed/types/playbook-pattern';
import type { PlaybookTranslation } from './types';
import { LEVEL_COLOR, EmptyState } from './empty-state';

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card/50">
          <CardHeader className="pb-2">
            <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Film className="h-4 w-4 text-primary" />
              {t('hookStyles')} ({hookPatterns.length})
            </div>
          </CardHeader>
          <CardContent>
            {hookPatterns.length > 0 ? (
              <div className="space-y-2">
                {hookPatterns.slice(0, 3).map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-xs">
                    <span className="font-mono font-medium">{p.featureValue}</span>
                    <Badge className={LEVEL_COLOR[p.confidenceLevel]}>
                      {Math.round(p.confidence * 100)}%
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t('noData')}</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardHeader className="pb-2">
            <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Mic className="h-4 w-4 text-primary" />
              {t('voiceProfiles')} ({voicePatterns.length})
            </div>
          </CardHeader>
          <CardContent>
            {voicePatterns.length > 0 ? (
              <div className="space-y-2">
                {voicePatterns.slice(0, 3).map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-xs">
                    <span className="font-mono font-medium">{p.featureValue}</span>
                    <Badge className={LEVEL_COLOR[p.confidenceLevel]}>
                      {Math.round(p.confidence * 100)}%
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t('noData')}</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardHeader className="pb-2">
            <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              {t('durationPatterns')} ({durationPatterns.length})
            </div>
          </CardHeader>
          <CardContent>
            {durationPatterns.length > 0 ? (
              <div className="space-y-2">
                {durationPatterns.slice(0, 3).map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-xs">
                    <span className="font-mono font-medium">{p.featureValue}</span>
                    <Badge className={LEVEL_COLOR[p.confidenceLevel]}>
                      {Math.round(p.confidence * 100)}%
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t('noData')}</p>
            )}
          </CardContent>
        </Card>
      </div>

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
