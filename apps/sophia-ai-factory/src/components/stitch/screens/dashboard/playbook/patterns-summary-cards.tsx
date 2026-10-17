// i18n-namespace: dashboard.playbook
import React from 'react';
import { Card, CardContent, CardHeader, Badge } from '@/components/stitch';
import { Film, Mic, Clock } from 'lucide-react';
import type { PlaybookPattern } from '@/seed/types/playbook-pattern';
import type { PlaybookTranslation } from './types';
import { LEVEL_COLOR } from './empty-state';

interface PatternSummaryCardProps {
  icon: React.ReactNode;
  title: string;
  items: PlaybookPattern[];
  noDataText: string;
}

function PatternSummaryCard({ icon, title, items, noDataText }: PatternSummaryCardProps) {
  return (
    <Card className="bg-card/50">
      <CardHeader className="pb-2">
        <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          {icon}
          {title} ({items.length})
        </div>
      </CardHeader>
      <CardContent>
        {items.length > 0 ? (
          <div className="space-y-2">
            {items.slice(0, 3).map((p) => (
              <div key={p.id} className="flex items-center justify-between text-xs">
                <span className="font-mono font-medium">{p.featureValue}</span>
                <Badge className={LEVEL_COLOR[p.confidenceLevel]}>
                  {Math.round(p.confidence * 100)}%
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{noDataText}</p>
        )}
      </CardContent>
    </Card>
  );
}

interface PatternsSummaryGridProps {
  hookPatterns: PlaybookPattern[];
  voicePatterns: PlaybookPattern[];
  durationPatterns: PlaybookPattern[];
  t: PlaybookTranslation;
}

export function PatternsSummaryGrid({
  hookPatterns,
  voicePatterns,
  durationPatterns,
  t,
}: PatternsSummaryGridProps) {
  const noDataText = t('noData');
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <PatternSummaryCard
        icon={<Film className="h-4 w-4 text-primary" />}
        title={t('hookStyles')}
        items={hookPatterns}
        noDataText={noDataText}
      />
      <PatternSummaryCard
        icon={<Mic className="h-4 w-4 text-primary" />}
        title={t('voiceProfiles')}
        items={voicePatterns}
        noDataText={noDataText}
      />
      <PatternSummaryCard
        icon={<Clock className="h-4 w-4 text-primary" />}
        title={t('durationPatterns')}
        items={durationPatterns}
        noDataText={noDataText}
      />
    </div>
  );
}
