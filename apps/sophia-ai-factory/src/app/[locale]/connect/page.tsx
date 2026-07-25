'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function ConnectPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'ready' | 'done'>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const linked = searchParams.get('linked');
        if (!linked) {
          if (!cancelled) setStatus('ready');
          return;
        }
        const res = await fetch('/api/telegram/link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: linked }),
        });
        const result = await res.json();
        if (!res.ok) {
          console.error('[connect] link failed', result);
        }
      } catch (error) {
        console.error('[connect] unexpected', error);
      } finally {
        if (!cancelled) setStatus('done');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  if (status === 'loading') return <p>Loading...</p>;
  return <p>Telegram linked. Return to Telegram to continue.</p>;
}
