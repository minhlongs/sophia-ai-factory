'use client';

import { lazy, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Video, Image, Mic2, LayoutTemplate, Palette, Mail } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/seed/components/ui/tabs';
import type { Tier } from '@/seed/types';

const VideoCreatorTab = lazy(() =>
  import('./components/video-creator-tab').then((m) => ({ default: m.VideoCreatorTab })),
);

const ImageGeneratorTab = lazy(() =>
  import('./components/image-generator-tab').then((m) => ({ default: m.ImageGeneratorTab })),
);

const AudioStudioTab = lazy(() =>
  import('./components/audio-studio-tab').then((m) => ({ default: m.AudioStudioTab }))
);

const TemplateLibraryTab = lazy(() =>
  import('./components/template-library-tab').then((m) => ({ default: m.TemplateLibraryTab }))
);

const BrandAssetsTab = lazy(() =>
  import('./components/brand-assets-tab').then((m) => ({ default: m.BrandAssetsTab }))
);

const NewsletterWriterTab = lazy(() =>
  import('./components/newsletter-writer-tab').then((m) => ({ default: m.NewsletterWriterTab }))
);

function VideoTabSkeleton() {
  return (
    <div className="grid animate-pulse grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(320px,1.1fr)]">
      <div className="flex flex-col gap-4">
        <div className="h-4 w-24 rounded bg-muted" />
        <div className="h-36 rounded-md bg-muted" />
        <div className="h-4 w-20 rounded bg-muted" />
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-muted" />
          ))}
        </div>
      </div>
      <div className="h-48 rounded-lg bg-muted" />
    </div>
  );
}

interface CreativeStudioTabsProps {
  tier: Tier;
  activeTab: string;
  locale: string;
}

const TAB_ICONS = {
  video: Video,
  image: Image,
  audio: Mic2,
  newsletter: Mail,
  templates: LayoutTemplate,
  brand: Palette,
} as const;

type TabKey = keyof typeof TAB_ICONS;
const TAB_KEYS: TabKey[] = ['video', 'image', 'audio', 'newsletter', 'templates', 'brand'];

function TabPlaceholder({ tabName }: { tabName: string }) {
  return (
    <div className="flex items-center justify-center h-64 rounded-lg border border-dashed border-border">
      <p className="text-muted-foreground text-sm">{tabName} — Coming soon</p>
    </div>
  );
}

export function CreativeStudioTabs({ tier, activeTab, locale }: CreativeStudioTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('creativeStudio');

  // locale reserved for future per-tab i18n gating
  void locale;

  function handleTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', value);
    router.push(`?${params.toString()}`, { scroll: false });
  }

  const validTab = TAB_KEYS.includes(activeTab as TabKey) ? activeTab : 'video';

  return (
    <Tabs value={validTab} onValueChange={handleTabChange} className="w-full">
      <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl border border-border bg-muted/70 p-1 sm:grid-cols-3 lg:grid-cols-6">
        {TAB_KEYS.map((key) => {
          const Icon = TAB_ICONS[key];
          return (
            <TabsTrigger
              key={key}
              value={key}
              className="min-h-11 cursor-pointer justify-start gap-2 rounded-lg px-3 py-2 text-sm data-[state=active]:shadow-sm"
            >
              <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{t(`tabs.${key}`)}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>

      <TabsContent value="video" className="mt-4">
        <Suspense fallback={<VideoTabSkeleton />}>
          <VideoCreatorTab tier={tier} />
        </Suspense>
      </TabsContent>

      <TabsContent value="image" className="mt-4">
        <Suspense fallback={<TabPlaceholder tabName={t('tabs.image')} />}>
          <ImageGeneratorTab tier={tier} />
        </Suspense>
      </TabsContent>

      <TabsContent value="audio" className="mt-4">
        <Suspense fallback={<TabPlaceholder tabName={t('tabs.audio')} />}>
          <AudioStudioTab tier={tier} />
        </Suspense>
      </TabsContent>

      <TabsContent value="newsletter" className="mt-4">
        <Suspense fallback={<TabPlaceholder tabName={t('tabs.newsletter')} />}>
          <NewsletterWriterTab tier={tier} />
        </Suspense>
      </TabsContent>

      <TabsContent value="templates" className="mt-4">
        <Suspense fallback={<TabPlaceholder tabName={t('tabs.templates')} />}>
          <TemplateLibraryTab tier={tier} />
        </Suspense>
      </TabsContent>

      <TabsContent value="brand" className="mt-4">
        <Suspense fallback={<TabPlaceholder tabName={t('tabs.brand')} />}>
          <BrandAssetsTab tier={tier} />
        </Suspense>
      </TabsContent>
    </Tabs>
  );
}
