'use client';

import type { ChannelProvider } from '@/seed/types/channel-provider';

const CHANNEL_META: Record<
  string,
  { label: string; icon: string; color: string }
> = {
  youtube: {
    label: 'YouTube',
    icon: 'SmartDisplay',
    color: '#FF0000',
  },
  tiktok: {
    label: 'TikTok',
    icon: 'MusicNote',
    color: '#000000',
  },
  instagram: {
    label: 'Instagram',
    icon: 'PhotoCamera',
    color: '#E4405F',
  },
  facebook: {
    label: 'Facebook',
    icon: 'ThumbUp',
    color: '#1877F2',
  },
  telegram: {
    label: 'Telegram',
    icon: 'Send',
    color: '#0088cc',
  },
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Connected',
  disconnected: 'Disconnected',
  expired: 'Expired',
  error: 'Error',
};

export interface ChannelCardProps {
  provider: ChannelProvider;
  status: 'active' | 'disconnected' | 'expired' | 'error';
  displayName?: string | null;
  lastPublishedAt?: number | null;
  followerCount?: number;
  totalPosts?: number;
  avgEngagement?: number;
  onConnect: (provider: ChannelProvider) => void;
  onDisconnect: (provider: ChannelProvider) => void;
  isConnecting: boolean;
}

export function ChannelCard({
  provider,
  status,
  displayName,
  lastPublishedAt,
  followerCount,
  totalPosts,
  avgEngagement,
  onConnect,
  onDisconnect,
  isConnecting,
}: ChannelCardProps) {
  const meta = CHANNEL_META[provider] ?? {
    label: provider,
    icon: 'Public',
    color: '#888888',
  };

  const isConnected = status === 'active';
  const statusColor =
    status === 'active'
      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      : status === 'expired'
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
        : status === 'error'
          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          : 'bg-muted text-muted-foreground';

  const formatNumber = (n: number | undefined): string => {
    if (n == null) return '—';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  };

  const formatTime = (ts: number | null | undefined): string => {
    if (!ts) return 'Never';
    const d = new Date(ts * 1000);
    return d.toLocaleDateString('vi-VN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3 hover:border-primary/20 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${meta.color}15` }}
          >
            <span
              className="material-symbols-outlined text-xl"
              style={{ color: meta.color }}
            >
              {meta.icon}
            </span>
          </div>
          <div>
            <p className="font-semibold text-sm text-foreground">{meta.label}</p>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${statusColor}`}
            >
              {STATUS_LABELS[status] ?? status}
            </span>
          </div>
        </div>
      </div>

      {/* Account name */}
      {isConnected && displayName && (
        <p className="text-xs text-muted-foreground truncate">{displayName}</p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">Followers</p>
          <p className="font-semibold text-foreground">
            {formatNumber(followerCount)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Total Posts</p>
          <p className="font-semibold text-foreground">
            {formatNumber(totalPosts)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Avg Engagement</p>
          <p className="font-semibold text-foreground">
            {avgEngagement != null ? `${avgEngagement.toFixed(1)}%` : '—'}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Last Publish</p>
          <p className="font-semibold text-foreground">
            {formatTime(lastPublishedAt)}
          </p>
        </div>
      </div>

      {/* Action */}
      {isConnected ? (
        <button
          type="button"
          onClick={() => onDisconnect(provider)}
          className="w-full text-xs px-3 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
        >
          Disconnect
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onConnect(provider)}
          disabled={isConnecting}
          className="w-full text-xs px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {isConnecting ? 'Connecting...' : 'Connect'}
        </button>
      )}
    </div>
  );
}

export { CHANNEL_META };
