export const dynamic = 'force-dynamic';

import React from 'react';
import { ControlDeckHub } from '@/components/stitch/screens/control-deck';
import { loadLiveControlDeckTelemetry } from '@/forest/control-deck';

export default async function ControlDeckRoute({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const initialLang = locale === 'vi' ? 'vi' : 'en';
  const { dataset } = await loadLiveControlDeckTelemetry();

  return <ControlDeckHub dataset={dataset} initialLang={initialLang} />;
}
