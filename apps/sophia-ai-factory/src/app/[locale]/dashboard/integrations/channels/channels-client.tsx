/**
 * Client component for OAuth social channel management.
 * Shows connect/disconnect buttons for 6 publishing providers.
 * @module app/[locale]/dashboard/integrations/channels/channels-client
 */
'use client';

import { useEffect, useState, useCallback } from 'react';

interface ChannelInfo {
  provider: string;
  connected: boolean;
  display_name: string | null;
  status: string | null;
}

const CHANNEL_META: Record<string, { label: string; icon: string; connectPath: string; scope?: string }> = {
  youtube: {
    label: 'YouTube',
    icon: 'smart_display',
    connectPath: '/api/oauth/youtube/connect',
  },
  tiktok: {
    label: 'TikTok',
    icon: 'music_video',
    connectPath: '/api/oauth/tiktok/connect',
  },
  instagram: {
    label: 'Instagram',
    icon: 'photo_camera',
    connectPath: '/api/oauth/instagram/connect',
  },
  pinterest: {
    label: 'Pinterest',
    icon: 'push_pin',
    connectPath: '/api/oauth/pinterest',
  },
  linkedin: {
    label: 'LinkedIn',
    icon: 'work',
    connectPath: '/api/oauth/linkedin',
  },
  zalo: {
    label: 'Zalo',
    icon: 'chat',
    connectPath: '/api/oauth/zalo',
  },
};

const CHANNEL_ORDER = Object.keys(CHANNEL_META);

export default function ChannelsClient({ userId }: { userId: string }) {
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChannels = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/integrations/channels');
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json() as { channels: ChannelInfo[] };
      setChannels(data.channels ?? []);
    } catch {
      // render disconnected state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchChannels();
    // Re-fetch after OAuth redirect returns (hash or query param signal)
    const onFocus = () => { void fetchChannels(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchChannels]);

  async function handleDisconnect(provider: string) {
    if (!confirm(`Disconnect ${CHANNEL_META[provider]?.label ?? provider}?`)) return;
    await fetch(`/api/v1/integrations/channels/${provider}`, { method: 'DELETE' });
    void fetchChannels();
  }

  const getChannel = (p: string): ChannelInfo =>
    channels.find(c => c.provider === p) ?? { provider: p, connected: false, display_name: null, status: null };

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Social Channels</h1>
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Social Channels</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your social accounts to enable direct publishing from Sophia campaigns.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {CHANNEL_ORDER.map(provider => {
          const meta = CHANNEL_META[provider];
          const info = getChannel(provider);

          return (
            <div key={provider} className="bg-card border rounded-lg p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-xl">{meta.icon}</span>
                  <span className="font-medium text-sm">{meta.label}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  info.connected
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {info.connected ? 'Connected' : 'Not connected'}
                </span>
              </div>

              {info.connected && info.display_name && (
                <p className="text-xs text-muted-foreground truncate">{info.display_name}</p>
              )}

              <div className="flex gap-2">
                {!info.connected ? (
                  <a
                    href={meta.connectPath}
                    className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                  >
                    Connect
                  </a>
                ) : (
                  <button
                    onClick={() => handleDisconnect(provider)}
                    className="text-xs px-3 py-1.5 border border-red-200 text-red-600 rounded-md hover:bg-red-50 transition-colors"
                  >
                    Disconnect
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-muted/40 border rounded-lg p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">OAuth permissions</p>
        <p>
          Connecting grants Sophia publish-only access. You can revoke at any time from the
          channel settings above or directly from each platform.
        </p>
      </div>
    </div>
  );
}
