/**
 * Client component for Social Channels page.
 * Renders channel cards with connect/disconnect actions.
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import type { ChannelProvider } from '@/seed/types/channel-provider';
import { ChannelCard } from '@/components/social/channel-card';
import { Card, CardContent } from '@/seed/components/ui/card';

interface ChannelData {
  provider: string;
  display_name: string | null;
  status: string;
  followers_count: number;
  last_published_at: number | null;
  total_posts: number;
  avg_engagement: number | null;
}

export default function ChannelsClient({
  userId,
  initialChannels = [],
}: {
  userId: string;
  initialChannels: ChannelData[];
}) {
  const t = useTranslations('socialPages.channels');
  const [channels, setChannels] = useState<ChannelData[]>(initialChannels);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);

  const fetchChannels = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/social/channels');
      if (res.ok) {
        const data = await res.json();
        setChannels(data.channels ?? []);
      }
    } catch {
      // keep existing state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchChannels();
    const onFocus = () => void fetchChannels();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchChannels]);

  const handleConnect = useCallback((provider: ChannelProvider) => {
    setConnecting(provider);
    // Initiate OAuth flow via the v1 integrations channel route
    window.location.href = `/api/v1/integrations/channels/${provider}/connect`;
  }, []);

  const handleDisconnect = useCallback(
    async (provider: ChannelProvider) => {
      const label =
        provider.charAt(0).toUpperCase() + provider.slice(1);
      if (!confirm(t('confirmDisconnect', { provider: label }))) return;
      await fetch(`/api/v1/integrations/channels/${provider}`, {
        method: 'DELETE',
      });
      void fetchChannels();
    },
    [t, fetchChannels],
  );

  const providers: ChannelProvider[] = [
    'youtube',
    'tiktok',
    'instagram',
    'facebook',
    'telegram',
  ];

  // Quick stats
  const connectedCount = channels.filter((c) => c.status === 'active').length;
  const totalPosts = channels.reduce((sum, c) => sum + (c.total_posts ?? 0), 0);
  const avgEng = channels.length
    ? Math.round(
        channels.reduce((sum, c) => sum + (c.avg_engagement ?? 0), 0) /
          channels.length,
      )
    : null;

  if (loading && channels.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('loading') ?? 'Loading...'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('subtitle')}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t('totalChannels')}</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {channels.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t('activeChannels')}</p>
            <p className="text-2xl font-bold text-foreground mt-1 text-green-600">
              {connectedCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t('totalPostsAll')}</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {totalPosts.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Channel Grid */}
      {channels.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground text-sm">{t('noChannels')}</p>
            <p className="text-muted-foreground text-xs mt-1">
              {t('connectFirst')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {providers.map((provider) => {
            const data = channels.find(
              (c) => c.provider.toLowerCase() === provider,
            );
            return (
              <ChannelCard
                key={provider}
                provider={provider}
                status={(data?.status as
                  | 'active'
                  | 'disconnected'
                  | 'expired'
                  | 'error') ?? 'disconnected'}
                displayName={data?.display_name ?? null}
                lastPublishedAt={data?.last_published_at ?? null}
                followerCount={data?.followers_count}
                totalPosts={data?.total_posts}
                avgEngagement={data?.avg_engagement ?? undefined}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                isConnecting={connecting === provider}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
