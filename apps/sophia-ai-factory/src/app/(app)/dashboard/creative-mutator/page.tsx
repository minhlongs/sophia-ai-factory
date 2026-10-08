/**
 * @file page.tsx
 * @description Darwinian Creative Auto-Mutator Dashboard Page Route
 * @layer Land/App Route
 */

export const dynamic = 'force-dynamic';

import React from 'react';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { redirect } from 'next/navigation';
import { CreativeMutatorCockpitView } from '@/components/creative-mutator/creative-mutator-cockpit-view';
import { listUserMutations } from '@/tree/creative/mutation-store';
import { triggerMutationAction } from '@/land/creative/actions/mutation-actions';
import type { CreativeMutationRecord } from '@/seed/types/creative-mutator-types';

export default async function CreativeMutatorPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/vi/login');
  }

  let mutations: CreativeMutationRecord[] = [];

  try {
    mutations = await listUserMutations(user.id, 50);
  } catch {
    // Defaults on clean tables
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <CreativeMutatorCockpitView
        initialMutations={mutations}
        onTriggerMutation={async (params) => {
          'use server';
          return triggerMutationAction({
            parentJobId: params.parentJobId,
            generation: 0,
            mutationIntensity: params.intensity,
            triggerReason: params.reason,
          });
        }}
      />
    </div>
  );
}
