export const dynamic = 'force-dynamic';

import React from 'react';
import { ControlDeckHub } from '@/components/stitch/screens/control-deck';
import { loadLiveControlDeckTelemetry } from '@/forest/control-deck';
import type { ControlDeckScreenId } from '@/seed/types/stitch-control-deck';

export default async function ControlDeckRoute({
  params,
  searchParams,
}: {
  readonly params: Promise<{ locale: string }>;
  readonly searchParams?: Promise<{ screen?: string }>;
}) {
  const { locale } = await params;
  const resolvedSearch = searchParams ? await searchParams : undefined;
  const initialLang = locale === 'vi' ? 'vi' : 'en';
  const { dataset } = await loadLiveControlDeckTelemetry();
  const matchedScreen = dataset.screens.find(
    (item) => item.id === resolvedSearch?.screen,
  );
  const initialScreenId: ControlDeckScreenId = matchedScreen?.id ?? 'dashboard';

  return (
    <ControlDeckHub
      dataset={dataset}
      initialLang={initialLang}
      initialScreenId={initialScreenId}
    />
  );
}
