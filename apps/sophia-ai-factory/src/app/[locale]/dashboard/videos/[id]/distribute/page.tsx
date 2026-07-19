/**
 * /dashboard/videos/[id]/distribute — server component
 * Loads user's connected channels, renders distribute panel.
 *
 * @module app/[locale]/dashboard/videos/[id]/distribute/page
 */

import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient, getD1 } from '@/seed/db/client';
import { localizedHref } from '@/seed/utils/localized-href';
import { getUserChannels } from '@/seed/db/get-user-channels';
import { DistributePanel } from './distribute-panel';
import { DistributeStatusPanel } from '@/components/distribute/distribute-status-panel';

interface VideoRow {
  id: string;
  user_id: string;
  title: string | null;
  status: 'processing' | 'completed' | 'failed';
  video_url: string | null;
}

export default async function DistributePage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const user = await getCurrentUser();
  const { id: videoId, locale } = await params;
  if (!user) redirect(localizedHref(locale, '/login'));

  const t = await getTranslations('dashboard.videos.distribute');

  const db = createServerClient();

  // Load video — verify ownership
  const { data: videoData } = await db
    .from('videos')
    .select('id, user_id, title, status, video_url')
    .eq('id', videoId)
    .maybeSingle();

  const video = videoData as VideoRow | null;
  if (!video) notFound();
  if (video.user_id !== user.id) notFound();

  // Only allow distribution for completed videos with a video_url
  if (video.status !== 'completed' || !video.video_url) {
    redirect(localizedHref(locale, `/dashboard/videos/${videoId}`));
  }

  // Load all user channels (active + inactive) to show connect status
  const d1 = getD1();
  if (!d1) throw new Error('D1 database binding not available');
  const channels = await getUserChannels(d1, user.id, false);

  const videoDetailHref = localizedHref(locale, `/dashboard/videos/${videoId}`);

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-2xl">
      <header>
        <a
          href={videoDetailHref}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {t('backToVideo')}
        </a>
        <h1 className="text-2xl font-semibold mt-1">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
      </header>
      <DistributePanel videoId={videoId} channels={channels} />
      <DistributeStatusPanel videoId={videoId} />
    </div>
  );
}
