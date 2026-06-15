'use client';

/**
 * Crisp.im live-chat widget loader.
 *
 * Mounts the official Crisp script when `NEXT_PUBLIC_CRISP_WEBSITE_ID` is set.
 * No-op when the env var is missing — safe to leave mounted in production
 * before the founder picks a support provider.
 *
 * Crisp Free tier: unlimited conversations, 2 seats, web + email channels.
 * Docs: https://help.crisp.chat/en/article/how-to-install-crisp-live-chat-on-your-website-dkrg33/
 */

import { useEffect } from 'react';

interface CrispGlobals {
  $crisp?: unknown[];
  CRISP_WEBSITE_ID?: string;
}

export function CrispWidget() {
  useEffect(() => {
    const siteId = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID;
    if (!siteId) return;

    const w = window as Window & CrispGlobals;
    if (w.$crisp) return;

    w.$crisp = [];
    w.CRISP_WEBSITE_ID = siteId;

    const script = document.createElement('script');
    script.src = 'https://client.crisp.chat/l.js';
    script.async = true;
    document.head.appendChild(script);

    return () => {
      const existing = document.querySelector<HTMLScriptElement>(
        'script[src="https://client.crisp.chat/l.js"]',
      );
      if (existing) existing.remove();
    };
  }, []);

  return null;
}
