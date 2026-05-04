'use client';

/**
 * TikTok connection settings panel.
 * Lets users connect / disconnect their TikTok account via OAuth2.
 * Connection status is fetched from GET /api/user/integrations.
 */

import { useEffect, useState, useTransition } from 'react';
import { Button } from '@/seed/components/ui/button';

interface Integration {
  network_id: string;
  is_active: boolean;
}

interface IntegrationsResponse {
  integrations: Integration[];
}

function generateState(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function TikTokConnectionSettings() {
  const [isConnected, setIsConnected] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch('/api/user/integrations');
        if (!res.ok) return;
        const data = (await res.json()) as IntegrationsResponse;
        const tiktok = data.integrations?.find((i) => i.network_id === 'tiktok');
        if (tiktok?.is_active) {
          setIsConnected(true);
        }
      } catch {
        // silently ignore — not critical
      } finally {
        setIsLoading(false);
      }
    }

    void fetchStatus();

    // Read display_name from query param set after successful OAuth
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'tiktok_connected') {
      setIsConnected(true);
    }
  }, []);

  function handleConnect() {
    startTransition(() => {
      const state = generateState();
      sessionStorage.setItem('tiktok_oauth_state', state);
      // getAuthorizationUrl runs on the client — env var must be public or passed via API
      // We call the server-side redirect instead to avoid exposing client_key
      window.location.href = `/api/auth/tiktok/start?state=${state}`;
    });
  }

  function handleDisconnect() {
    startTransition(async () => {
      try {
        await fetch('/api/user/integrations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ network: 'tiktok', api_key: '', api_secret: '' }),
        });
        setIsConnected(false);
        setDisplayName(null);
      } catch {
        // silently ignore
      }
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 rounded-lg border p-4">
        <div className="h-8 w-8 motion-safe:animate-pulse rounded-full bg-muted" />
        <div className="h-4 w-32 motion-safe:animate-pulse rounded bg-muted" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-white text-sm font-bold">
          T
        </div>
        <div>
          <p className="text-sm font-medium">TikTok</p>
          {isConnected && displayName ? (
            <p className="text-xs text-muted-foreground">@{displayName}</p>
          ) : isConnected ? (
            <p className="text-xs text-green-600">Đã kết nối</p>
          ) : (
            <p className="text-xs text-muted-foreground">Chưa kết nối</p>
          )}
        </div>
      </div>

      {isConnected ? (
        <Button
          variant="outline"
          size="sm"
          onClick={handleDisconnect}
          disabled={isPending}
        >
          Disconnect
        </Button>
      ) : (
        <Button
          size="sm"
          onClick={handleConnect}
          disabled={isPending}
        >
          Connect TikTok
        </Button>
      )}
    </div>
  );
}
