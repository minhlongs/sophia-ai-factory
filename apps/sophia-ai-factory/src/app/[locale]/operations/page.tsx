import React from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { CustomerOperationsView, type BatchJobItem, type ChannelSyndicationStats } from '@/components/operations/customer-operations-view';
import { type ActiveProviderStatus } from '@/components/support/diagnostic-bundle-generator';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const isVi = locale === 'vi';
  return {
    title: isVi ? 'Trung tâm Vận hành | Sophia AI' : 'Operations Center | Sophia AI',
    description: isVi ? 'Giám sát hàng đợi render video và trạng thái đồng bộ kênh.' : 'Monitor batch video queue and channel syndication.',
  };
}

export default async function OperationsPage({ params }: PageProps) {
  const { locale: rawLocale } = await params;
  const locale = rawLocale === 'en' ? 'en' : 'vi';
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  let running = 0;
  let scheduled = 0;
  let completed = 0;
  let failed = 0;
  const recentJobs: BatchJobItem[] = [];
  let openTicketsCount = 0;
  const activeProviders: ActiveProviderStatus[] = [];

  const syndication: ChannelSyndicationStats = {
    youtube: { status: 'not_configured', activeVideosCount: 0 },
    tiktok: { status: 'not_configured', activeVideosCount: 0 },
    telegram: { status: 'not_connected', alertsEnabled: false },
  };

  try {
    const db = createServerClient();

    // 1. Batch jobs & video jobs telemetry
    const vJobs = await db.prepare(
      'SELECT id, status, prompt, created_at FROM video_jobs WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 15'
    ).bind(user.id).all<{ id: string; status: string; prompt: string; created_at: number }>();

    for (const j of vJobs.results ?? []) {
      let st: BatchJobItem['status'] = 'completed';
      if (['queued', 'scripting', 'tts_pending', 'visual_pending', 'composing'].includes(j.status)) {
        st = 'running';
        running += 1;
      } else if (j.status === 'scheduled') {
        st = 'scheduled';
        scheduled += 1;
      } else if (j.status === 'failed') {
        st = 'failed';
        failed += 1;
      } else {
        completed += 1;
      }
      recentJobs.push({
        id: j.id,
        title: j.prompt ? j.prompt.slice(0, 48) + (j.prompt.length > 48 ? '...' : '') : `Job ${j.id.slice(0, 8)}`,
        status: st,
        createdAt: new Date(j.created_at).toISOString(),
      });
    }

    // 2. YouTube configuration
    const ytConfig = await db.prepare(
      'SELECT channel_title, is_active FROM youtube_channel_configs WHERE user_id = ?1 LIMIT 1'
    ).bind(user.id).first<{ channel_title: string | null; is_active: number }>();
    if (ytConfig) {
      syndication.youtube = {
        status: ytConfig.is_active ? 'connected' : 'idle',
        channelTitle: ytConfig.channel_title ?? undefined,
        activeVideosCount: completed,
      };
    }

    // 3. Telegram pairing
    const tg = await db.prepare(
      'SELECT chat_id, paired_at FROM telegram_paired_chats WHERE paired_by = ?1 LIMIT 1'
    ).bind(user.id).first<{ chat_id: string; paired_at: string }>();
    if (tg?.chat_id) {
      syndication.telegram = { status: 'connected', alertsEnabled: true, pairedAt: tg.paired_at };
    }

    // 4. Open support tickets count
    const tCount = await db.prepare(
      "SELECT COUNT(*) as cnt FROM support_tickets WHERE user_id = ?1 AND status IN ('open', 'in_progress')"
    ).bind(user.id).first<{ cnt: number }>();
    if (tCount) openTicketsCount = tCount.cnt;

    // 5. Active BYOK providers
    const keys = await db.prepare(
      'SELECT provider FROM user_api_keys WHERE user_id = ?1'
    ).bind(user.id).all<{ provider: string }>();
    for (const k of keys.results ?? []) {
      activeProviders.push({ name: k.provider, configured: true, status: 'ACTIVE' });
    }
  } catch {
    // Safe fallbacks on schema/D1 unreadiness
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <CustomerOperationsView
          locale={locale}
          userId={user.id}
          batchQueue={{ runningCount: running, scheduledCount: scheduled, completedCount: completed, failedCount: failed, recentJobs }}
          syndication={syndication}
          openTicketsCount={openTicketsCount}
          appVersion="0.1.5"
          commitSha={process.env.COMMIT_SHA || 'c35840f4'}
          activeProviders={activeProviders}
        />
      </div>
    </div>
  );
}
