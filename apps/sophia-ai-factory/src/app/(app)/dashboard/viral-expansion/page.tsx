/**
 * @file page.tsx
 * @description Master Cockpit Page Route for Viral Audio, Kinetic Captions, and Cross-Border Dubbing
 * @layer Land/App Route
 */

export const dynamic = 'force-dynamic';

import React from 'react';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { redirect } from 'next/navigation';
import { ViralExpansionCockpitView } from '@/components/viral-expansion/viral-expansion-cockpit-view';
import { listViralSounds, listUserDubbingLineages } from '@/tree/dubbing/dubbing-store';
import type { ViralSoundTrack, LocalizedLineageRecord } from '@/seed/types/viral-expansion-types';

export default async function ViralExpansionPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/vi/login');
  }

  let sounds: ViralSoundTrack[] = [];
  let lineages: LocalizedLineageRecord[] = [];

  try {
    sounds = await listViralSounds(20);
  } catch {
    // Defaults on empty catalog
  }

  try {
    lineages = await listUserDubbingLineages(user.id, 50);
  } catch {
    // Defaults on clean tables
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-100 uppercase">
            Viral Audio & Multilingual Dubbing Cockpit
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Dynamic MAB Audio Ducking • Hormozi Kinetic Subtitles • Cross-Border Lip-Sync Lineages
          </p>
        </div>
      </div>

      <ViralExpansionCockpitView
        initialSounds={sounds}
        initialLineages={lineages}
      />
    </div>
  );
}
