'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/seed/components/ui/button';
import { CAMPAIGN_TEMPLATES } from '@/lib/templates/campaign-templates';
import { TemplateCard } from './template-card';
import type { Tier } from '@/seed/types';

interface TemplateLibraryTabProps {
  tier: Tier;
}

type FilterKey = 'all' | 'campaign' | 'video';

const VIDEO_TEMPLATES = [
  {
    id: 'video-cinematic',
    name: 'Cinematic Story',
    description: 'Full-screen cinematic video with dramatic transitions and professional pacing',
    category: 'video',
    path: 'path-a',
  },
  {
    id: 'video-overlay',
    name: 'Overlay Highlight',
    description: 'Dynamic text overlays on video with animated callouts and branded graphics',
    category: 'video',
    path: 'path-b',
  },
];

export function TemplateLibraryTab({ tier }: TemplateLibraryTabProps) {
  void tier;
  const t = useTranslations('creativeStudio.templates');
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');

  const filters: { key: FilterKey; label: string }[] = [
    { key: 'all', label: t('filterAll') },
    { key: 'campaign', label: t('filterCampaign') },
    { key: 'video', label: t('filterVideo') },
  ];

  const showCampaign = activeFilter === 'all' || activeFilter === 'campaign';
  const showVideo = activeFilter === 'all' || activeFilter === 'video';

  return (
    <div className="space-y-8">
      {/* Filter tabs */}
      <div className="flex gap-2">
        {filters.map(({ key, label }) => (
          <Button
            key={key}
            variant={activeFilter === key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveFilter(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Campaign Templates section */}
      {showCampaign && (
        <section>
          <h2 className="text-base font-semibold mb-4">{t('campaignTemplates')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CAMPAIGN_TEMPLATES.map((template) => (
              <TemplateCard
                key={template.id}
                id={template.id}
                name={template.name}
                description={template.description}
                category={template.category}
                onUse={() =>
                  router.push(`/dashboard/create?template=${template.id}`)
                }
              />
            ))}
          </div>
        </section>
      )}

      {/* Video Templates section */}
      {showVideo && (
        <section>
          <h2 className="text-base font-semibold mb-4">{t('videoTemplates')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {VIDEO_TEMPLATES.map((template) => (
              <TemplateCard
                key={template.id}
                id={template.id}
                name={template.name}
                description={template.description}
                category={template.category}
                onUse={() =>
                  router.push(
                    `/dashboard/create?template=${template.id}&path=${template.path}`
                  )
                }
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
