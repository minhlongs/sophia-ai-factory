'use client';

import { useEffect, useCallback } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { AnalyticsEventType } from '@/lib/builder/types';

interface TrackerProps {
  landingPageId: string;
  variantId?: string;
  endpoint?: string;
}

export const Tracker: React.FC<TrackerProps> = ({ landingPageId, variantId, endpoint = 'http://localhost:8000/api/landing-pages/analytics/events' }) => {
  const pathname = usePathname();
  const sendEvent = useCallback(async (eventType: string, metadata: Record<string, unknown> = {}) => {
    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ landing_page_uuid: landingPageId, variant_id: variantId, event_type: eventType, metadata: { path: pathname, referrer: document.referrer, timestamp: new Date().toISOString(), screen_width: window.innerWidth, screen_height: window.innerHeight, ...metadata } }),
      });
    } catch { console.error('Failed to send analytics event'); }
  }, [endpoint, landingPageId, variantId, pathname]);

  useEffect(() => { sendEvent(AnalyticsEventType.PAGE_VIEW); }, [sendEvent]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      sendEvent(AnalyticsEventType.CLICK, { x: e.pageX, y: e.pageY, tag: target.tagName, id: target.id, text: target.innerText?.substring(0, 50) });
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [sendEvent]);

  useEffect(() => {
    let maxScroll = 0, timeout: NodeJS.Timeout;
    const handleScroll = () => {
      const scrollPercent = Math.round((window.scrollY + window.innerHeight) / document.body.scrollHeight * 100);
      if (scrollPercent > maxScroll) maxScroll = scrollPercent;
      clearTimeout(timeout);
      timeout = setTimeout(() => {}, 1000);
    };
    window.addEventListener('scroll', handleScroll);
    return () => { window.removeEventListener('scroll', handleScroll); clearTimeout(timeout); if (maxScroll > 0) sendEvent(AnalyticsEventType.SCROLL, { depth_percentage: maxScroll }); };
  }, [sendEvent]);

  return null;
};
