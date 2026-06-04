'use client';

/**
 * YouTube connection settings panel.
 * Lets users connect / disconnect their YouTube account via OAuth2.
 * Connection status is derived from GET /api/user/youtube-connection-status.
 * OAuth flow starts via /api/oauth/youtube/connect (server-side redirect).
 */

import { useEffect, useState, useTransition } from 'react';

interface YouTubeConnectionStatus {
  connected: boolean;
  channelTitle?: string;
}

interface ApiKeysShape {
  youtube?: {
    refresh_token?: string;
    channel_title?: string;
  };
}

interface UserProfileApiResponse {
  api_keys?: ApiKeysShape;
}

export function YouTubeConnectionSettings() {
  const [status, setStatus] = useState<YouTubeConnectionStatus>({ connected: false });
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout> | null = null;
    async function fetchConnectionStatus() {
      try {
        const res = await fetch('/api/user/profile');
        if (!res.ok) return;
        const data = (await res.json()) as UserProfileApiResponse;
        const ytCreds = data.api_keys?.youtube;
        if (ytCreds?.refresh_token) {
          setStatus({
            connected: true,
            channelTitle: ytCreds.channel_title,
          });
        }
      } catch {
        // Not critical — silently ignore
      } finally {
        setIsLoading(false);
      }
    }

    void fetchConnectionStatus();

    // Handle query params set after OAuth redirect
    const params = new URLSearchParams(window.location.search);
    const connectedParam = params.get('youtube_connected') === 'true';
    const ytError = params.get('youtube_error');

    if (connectedParam || ytError) {
      timerId = setTimeout(() => {
        if (connectedParam) {
          setStatus({ connected: true });
        }
        if (ytError) {
          setErrorMessage(getErrorMessage(ytError));
        }
      }, 0);
    }

    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, []);

  function handleConnect() {
    startTransition(() => {
      window.location.href = '/api/oauth/youtube/connect';
    });
  }

  function handleDisconnect() {
    startTransition(async () => {
      try {
        const res = await fetch('/api/auth/youtube/disconnect', { method: 'POST' });
        if (res.ok) {
          setStatus({ connected: false });
          setErrorMessage(null);
        }
      } catch {
        // silently ignore
      }
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 rounded-lg border p-4">
        <div className="h-9 w-9 motion-safe:animate-pulse rounded-full bg-muted" />
        <div className="space-y-1">
          <div className="h-3 w-20 motion-safe:animate-pulse rounded bg-muted" />
          <div className="h-3 w-28 motion-safe:animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-white text-sm font-bold">
          Y
        </div>
        <div>
          <p className="text-sm font-medium">YouTube</p>
          {status.connected && status.channelTitle ? (
            <p className="text-xs text-muted-foreground">{status.channelTitle}</p>
          ) : status.connected ? (
            <p className="text-xs text-green-600">Đã kết nối</p>
          ) : (
            <p className="text-xs text-muted-foreground">Chưa kết nối</p>
          )}
          {errorMessage && (
            <p className="text-xs text-red-500 mt-0.5">{errorMessage}</p>
          )}
        </div>
      </div>

      {status.connected ? (
        <button
          type="button"
          onClick={handleDisconnect}
          disabled={isPending}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50 transition-all duration-150 active:scale-95"
        >
          Disconnect
        </button>
      ) : (
        <button
          type="button"
          onClick={handleConnect}
          disabled={isPending}
          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 hover:opacity-95 disabled:opacity-50 transition-all duration-150 active:scale-95"
        >
          Connect YouTube
        </button>
      )}
    </div>
  );
}

function getErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    access_denied: 'YouTube access was denied. Please try again.',
    missing_code: 'OAuth flow failed — missing code. Please try again.',
    no_refresh_token: 'YouTube did not return a refresh token. Please reconnect.',
    storage_failed: 'Failed to save YouTube credentials. Please try again.',
    unauthorized: 'You must be logged in to connect YouTube.',
    server_error: 'An unexpected error occurred. Please try again.',
  };
  return messages[code] ?? 'An error occurred connecting YouTube.';
}
