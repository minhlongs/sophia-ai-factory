/**
 * Image Studio — server component.
 *
 * Loads the signed-in user's own image jobs and the tier-derived model list,
 * then hands both to the client view. Reads only this tenant's rows; the
 * query layer enforces ownership.
 */

export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getUserTier } from '@/seed/db/get-user-tier';
import { createServerClient } from '@/seed/db/client';
import { listUserImageJobs } from '@/tree/creative-studio/image-job-queries';
import {
  loadImageJobsForView,
  normaliseImageJobsForView,
} from '@/tree/creative-studio/image-job-view-model';
import { ImageStudioView } from './image-studio-view';

export default async function ImageStudioPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/vi/login');
  }

  const result = await loadImageJobsForView(async () => {
    const rows = await listUserImageJobs(createServerClient(), user.id);
    return normaliseImageJobsForView(rows);
  });

  let tier = 'BASIC';
  try {
    tier = await getUserTier(user.id);
  } catch {
    // Defaults to the most restrictive model list.
  }

  return (
    <ImageStudioView
      initialJobs={result.loadFailed ? [] : result.jobs}
      historyLoadFailed={result.loadFailed}
      tier={tier}
    />
  );
}
