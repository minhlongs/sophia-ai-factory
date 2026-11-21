'use client';

import * as React from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { ArrowLeft, Check, Code2, Download, Layers } from 'lucide-react';
import { ZEN_DESIGN_TOKENS, type ZenThemeMode } from '@/seed/design-tokens';
import { ThemeToggle } from '@/forest/components/theme-toggle';
import { Badge } from '@/seed/components/ui/badge';
import { Button } from '@/seed/components/ui/button';
import { ColorContrastSection } from './color-contrast-section';
import { ComponentPlaygroundSection } from './component-playground-section';
import { DtcgExplorerSection } from './dtcg-explorer-section';
import { StudioStageSection } from './studio-stage-section';
import { buildCssVariablesExport, serializeDtcgJson } from './token-catalog';
import { TypographyMotionSection } from './typography-motion-section';

const NAV_ANCHORS = [
  { href: '#colors', key: 'nav.colors' },
  { href: '#typography-motion', key: 'nav.typography' },
  { href: '#studio-stage', key: 'nav.studioStage' },
  { href: '#playground', key: 'nav.playground' },
  { href: '#dtcg-explorer', key: 'nav.dtcg' },
] as const;

function DesignShowcaseHeader({
  locale,
  alternateLocale,
}: {
  locale: string;
  alternateLocale: string;
}) {
  const t = useTranslations('designShowcase');

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Link
            href={`/${locale}`}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t('nav.home')}</span>
          </Link>
          <span className="hidden h-4 w-px bg-border sm:inline-block" aria-hidden="true" />
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" aria-hidden="true" />
            <span className="font-mono text-xs font-semibold tracking-tight text-foreground">
              {ZEN_DESIGN_TOKENS.meta.system} v{ZEN_DESIGN_TOKENS.meta.version}
            </span>
          </div>
        </div>

        <nav aria-label={t('nav.sectionsAria')} className="hidden items-center gap-1 md:flex">
          {NAV_ANCHORS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {t(item.key)}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={`/${alternateLocale}/design`}
            className="inline-flex h-9 items-center justify-center rounded-xl border border-border bg-card/80 px-3 font-mono text-xs font-semibold uppercase text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted hover:text-foreground"
            aria-label={t('nav.switchLocaleAria')}
          >
            {alternateLocale}
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

export function DesignShowcasePage() {
  const t = useTranslations('designShowcase');
  const locale = useLocale();
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const [statusMessage, setStatusMessage] = React.useState('');
  const resetTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const revokeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    setMounted(true);
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
      if (revokeTimerRef.current) {
        clearTimeout(revokeTimerRef.current);
      }
    };
  }, []);

  const activeThemeMode: ZenThemeMode =
    mounted && (resolvedTheme ?? theme) === 'light' ? 'light' : 'dark';

  const alternateLocale = locale === 'vi' ? 'en' : 'vi';

  const announceFeedback = React.useCallback((key: string, message: string) => {
    setCopiedKey(key);
    setStatusMessage(message);
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = setTimeout(() => {
      setCopiedKey(null);
      setStatusMessage('');
    }, 2000);
  }, []);

  const handleCopy = React.useCallback(
    async (value: string, key: string) => {
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(value);
          announceFeedback(key, t('feedback.copied'));
          return;
        }
        setStatusMessage(t('feedback.copyUnavailable'));
      } catch {
        setStatusMessage(t('feedback.copyUnavailable'));
      }
    },
    [announceFeedback, t],
  );

  const handleDownloadDtcg = React.useCallback(() => {
    try {
      const content = serializeDtcgJson();
      const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'zen-design-tokens.dtcg.json';
      document.body.appendChild(link);
      link.click();
      link.remove();
      if (revokeTimerRef.current) {
        clearTimeout(revokeTimerRef.current);
      }
      revokeTimerRef.current = setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);
      announceFeedback('download-dtcg', t('feedback.downloaded'));
    } catch {
      setStatusMessage(t('feedback.copyUnavailable'));
    }
  }, [announceFeedback, t]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Screen-reader live region for copy / download feedback */}
      <div role="status" aria-live="polite" className="sr-only" data-testid="design-status-live">
        {statusMessage}
      </div>

      <DesignShowcaseHeader locale={locale} alternateLocale={alternateLocale} />

      <main
        id="main-content"
        className="mx-auto max-w-7xl space-y-16 px-4 py-10 sm:px-6 sm:py-14 lg:px-8"
      >
        {/* Hero */}
        <section aria-labelledby="design-hero-heading" className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="enterprise">
              {ZEN_DESIGN_TOKENS.meta.system} · v{ZEN_DESIGN_TOKENS.meta.version}
            </Badge>
            <Badge variant="outline" data-testid="active-theme-badge">
              {activeThemeMode === 'dark' ? t('theme.darkName') : t('theme.lightName')}
            </Badge>
          </div>

          <div className="max-w-3xl space-y-3">
            <h1
              id="design-hero-heading"
              className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl"
            >
              {t('hero.title')}
            </h1>
            <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
              {t('hero.subtitle')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleDownloadDtcg}
              data-testid="hero-download-dtcg"
              className="gap-2"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>{t('actions.downloadDtcgJson')}</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => handleCopy(buildCssVariablesExport(activeThemeMode), 'hero-css')}
              data-testid="hero-copy-css"
              className="gap-2"
            >
              {copiedKey === 'hero-css' ? (
                <Check className="h-4 w-4 text-emerald-500" aria-hidden="true" />
              ) : (
                <Code2 className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{t('actions.copyCssVars')}</span>
            </Button>
          </div>
        </section>

        <ColorContrastSection
          activeThemeMode={activeThemeMode}
          onCopy={handleCopy}
          copiedKey={copiedKey}
        />

        <TypographyMotionSection />

        <StudioStageSection />

        <ComponentPlaygroundSection />

        <DtcgExplorerSection
          activeThemeMode={activeThemeMode}
          onCopy={handleCopy}
          onDownloadDtcg={handleDownloadDtcg}
          copiedKey={copiedKey}
        />
      </main>
    </div>
  );
}
