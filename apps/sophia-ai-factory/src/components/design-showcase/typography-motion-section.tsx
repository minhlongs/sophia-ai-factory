'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Play, RotateCcw } from 'lucide-react';
import { Badge } from '@/seed/components/ui/badge';
import { Button } from '@/seed/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/seed/components/ui/card';
import { getMotionDurationEntries, getMotionEasingEntries } from './token-catalog';

const RADIUS_TOKENS = [
  { name: 'radius-sm', radiusValue: 'var(--radius-sm)', note: 'calc(var(--radius) - 4px) · 8px' },
  { name: 'radius-md', radiusValue: 'var(--radius-md)', note: 'calc(var(--radius) - 2px) · 10px' },
  { name: 'radius-lg', radiusValue: 'var(--radius-lg)', note: 'var(--radius) · 12px' },
  {
    name: 'radius-xl',
    radiusValue: 'calc(var(--radius) + 4px)',
    note: 'calc(var(--radius) + 4px) · 16px',
  },
] as const;

function TypographySpecimensGrid() {
  const t = useTranslations('designShowcase');

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Inter</CardTitle>
            <Badge variant="outline">--font-sans</Badge>
          </div>
          <CardDescription>{t('typography.interDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="font-sans text-3xl font-bold tracking-tight text-foreground">
            {t('typography.specimenHeadline')}
          </p>
          <p className="font-sans text-sm leading-relaxed text-muted-foreground">
            {t('typography.specimenBody')}
          </p>
          <p className="font-sans text-xs text-muted-foreground">
            Aa Bb Cc Đđ Ăă Ââ Êê Ôô Ơơ Ưư 0123456789
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>JetBrains Mono</CardTitle>
            <Badge variant="outline">--font-mono</Badge>
          </div>
          <CardDescription>{t('typography.monoDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="font-mono text-2xl font-semibold tabular-nums text-foreground">
            99.94% · 142ms
          </p>
          <pre className="overflow-x-auto rounded-lg border border-border bg-muted/60 p-3 font-mono text-xs text-foreground">
            <code>{`--primary: var(--primary);\nratio: 19.32:1 (WCAG AA)`}</code>
          </pre>
          <p className="font-mono text-xs text-muted-foreground">
            0123456789 · {} [] () =&gt; != ===
          </p>
        </CardContent>
      </Card>

      <Card className="v3-core">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Archivo</CardTitle>
            <Badge variant="secondary">.v3-core</Badge>
          </div>
          <CardDescription>{t('typography.archivoDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p
            className="text-2xl font-bold uppercase tracking-tight text-foreground"
            style={{ fontFamily: 'var(--font-display)' }}
            data-testid="archivo-specimen"
          >
            {t('typography.v3Specimen')}
          </p>
          <p className="text-sm text-muted-foreground">{t('typography.archivoRule')}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function MotionLabCard() {
  const t = useTranslations('designShowcase');
  const durations = React.useMemo(() => getMotionDurationEntries(), []);
  const easings = React.useMemo(() => getMotionEasingEntries(), []);
  const [motionActive, setMotionActive] = React.useState(false);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>{t('motion.title')}</CardTitle>
            <CardDescription>{t('motion.description')}</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setMotionActive((prev) => !prev)}
            data-testid="motion-replay-button"
            className="gap-2"
          >
            {motionActive ? (
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>{motionActive ? t('motion.reset') : t('motion.play')}</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
          {durations.map((item) => (
            <div
              key={item.role}
              className="space-y-2 rounded-xl border border-border bg-background/60 p-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold text-foreground">{item.role}</span>
                <span className="font-mono text-xs text-primary-text">{item.value}</span>
              </div>
              <p className="text-xs text-muted-foreground">{item.description}</p>
              <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary motion-reduce:transition-none"
                  style={{
                    width: motionActive ? '100%' : '18%',
                    transitionProperty: 'width',
                    transitionDuration: item.value,
                    transitionTimingFunction: 'var(--motion-ease-emphasized)',
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {easings.map((item) => (
            <div
              key={item.role}
              className="space-y-2 rounded-xl border border-border bg-background/60 p-3.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-foreground">
                  {item.cssVar}
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">{item.cssValue}</span>
              </div>
              <p className="text-xs text-muted-foreground">{item.description}</p>
              <div className="relative h-7 rounded-lg border border-border bg-muted/50 px-1.5">
                <div
                  className="absolute top-1.5 h-4 w-4 rounded-full bg-primary motion-reduce:transition-none"
                  style={{
                    left: motionActive ? 'calc(100% - 1.375rem)' : '0.375rem',
                    transitionProperty: 'left',
                    transitionDuration: '600ms',
                    transitionTimingFunction: item.cssValue,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function TypographyMotionSection() {
  const t = useTranslations('designShowcase');

  return (
    <section
      id="typography-motion"
      aria-labelledby="design-typography-heading"
      className="scroll-mt-24 space-y-8"
    >
      <div className="space-y-1.5">
        <Badge variant="premium">{t('typography.eyebrow')}</Badge>
        <h2
          id="design-typography-heading"
          className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
        >
          {t('typography.title')}
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
          {t('typography.description')}
        </p>
      </div>

      <TypographySpecimensGrid />

      <MotionLabCard />

      <Card>
        <CardHeader>
          <CardTitle>{t('radius.title')}</CardTitle>
          <CardDescription>{t('radius.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {RADIUS_TOKENS.map((item) => (
              <div
                key={item.name}
                className="flex flex-col items-center gap-2 rounded-xl border border-border bg-background/60 p-4 text-center"
              >
                <div
                  className="h-14 w-14 border-2 border-primary bg-primary/15"
                  style={{ borderRadius: item.radiusValue }}
                  aria-hidden="true"
                />
                <span className="font-mono text-xs font-semibold text-foreground">{item.name}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{item.note}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
