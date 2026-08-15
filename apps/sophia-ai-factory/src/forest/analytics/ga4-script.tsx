'use client'

/**
 * GA4 bootstrap component.
 *
 * Renders two GA4 script tags only in production when
 * NEXT_PUBLIC_GA4_MEASUREMENT_ID is set. Uses Next.js Script with
 * strategy="afterInteractive" so it doesn't block page load.
 *
 * Also captures UTM params from the URL on mount so they persist
 * through the signup → checkout funnel.
 *
 * @module lib/analytics/ga4-script
 */

import Script from 'next/script'
import { useEffect } from 'react'
import { captureUtmFromUrl } from '@/seed/utils/utm-capture'

interface Ga4ScriptProps {
  measurementId: string
}

export function Ga4Script({ measurementId }: Ga4ScriptProps) {
  // Capture UTM on every page load — overwrites stale params if new campaign URL
  useEffect(() => {
    captureUtmFromUrl()
  }, [])

  if (!measurementId) return null

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script
        id="ga4-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${measurementId}', {
  page_path: window.location.pathname,
  send_page_view: true
});
          `.trim(),
        }}
      />
    </>
  )
}
