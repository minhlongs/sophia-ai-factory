'use client'

/**
 * Client-side PostHog provider — initialises posthog-js on mount
 * RED-TEAM #11: PUBLIC key only; server-only events blocked at captureServer source check
 * Session recording + surveys disabled (slim bundle, privacy-first)
 */

import { useEffect } from 'react'
import posthog from 'posthog-js'

interface PostHogProviderProps {
  children: React.ReactNode
}

export function PostHogProvider({ children }: PostHogProviderProps) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com'

    if (!key || posthog.__loaded) return

    posthog.init(key, {
      api_host: host,
      // Slim bundle: disable heavyweight features
      disable_session_recording: true,
      enable_heatmaps: false,
      autocapture: false,  // manual tracking only — avoids accidental PII capture
      capture_pageview: true,
      capture_pageleave: false,
      // Privacy
      respect_dnt: true,
      sanitize_properties: (props) => {
        // Strip any accidental PII keys
        const safe = { ...props } as Record<string, unknown>
        delete safe['email']
        delete safe['name']
        delete safe['phone']
        return safe
      },
      loaded: (ph) => {
        if (process.env.NODE_ENV === 'development') {
          ph.opt_out_capturing()
        }
      },
    })
  }, [])

  return <>{children}</>
}
