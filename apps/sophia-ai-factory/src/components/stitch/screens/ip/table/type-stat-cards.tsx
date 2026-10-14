import React from 'react';
import { Card } from '@/components/stitch/ui';
import { TYPE_META } from './types';

interface TypeStatCardsProps {
  counts: Record<string, number>;
  t: (key: string) => string;
}

export function TypeStatCards({ counts, t }: TypeStatCardsProps) {
  return (
    <>
      {Object.entries(TYPE_META).map(([type, meta]) => {
        const Icon = meta.icon;
        return (
          <Card key={type} padding="lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-label-sm text-on-surface-variant">
                  {t(`type.${type}` as const)}
                </p>
                <p className="text-headline-sm">{counts[type] ?? 0}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </Card>
        );
      })}
    </>
  );
}
