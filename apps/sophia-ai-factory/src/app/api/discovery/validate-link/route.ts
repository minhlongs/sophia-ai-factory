import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserFromHeaders } from '@/lib/better-auth-session'

// Use Edge Runtime for low latency
export const runtime = 'edge'

/**
 * Validate that URL is a safe external HTTPS URL (prevent SSRF attacks).
 * Blocks internal/private IPs, non-HTTPS, and metadata endpoints.
 */
function isSafeUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString)

    // Only allow HTTPS
    if (url.protocol !== 'https:') return false

    const hostname = url.hostname.toLowerCase()

    // Block private/internal hostnames
    const blockedPatterns = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '169.254.169.254', // Cloud metadata endpoint
      'metadata.google.internal',
      '10.',
      '172.16.', '172.17.', '172.18.', '172.19.',
      '172.20.', '172.21.', '172.22.', '172.23.',
      '172.24.', '172.25.', '172.26.', '172.27.',
      '172.28.', '172.29.', '172.30.', '172.31.',
      '192.168.',
      '[::1]',
      'internal',
    ]

    for (const pattern of blockedPatterns) {
      if (hostname === pattern || hostname.startsWith(pattern)) return false
    }

    // Block .local, .internal TLDs
    if (hostname.endsWith('.local') || hostname.endsWith('.internal')) return false

    return true
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromHeaders(request.headers)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const targetUrl = searchParams.get('url')

  if (!targetUrl) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  }

  // SSRF protection: only allow safe external HTTPS URLs
  if (!isSafeUrl(targetUrl)) {
    return NextResponse.json(
      { valid: false, error: 'Only external HTTPS URLs are allowed' },
      { status: 400 }
    )
  }

  try {
    // Perform a HEAD request to check availability without downloading body
    const response = await fetch(targetUrl, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Sophia-Link-Validator/1.0'
      },
      redirect: 'manual', // Don't follow redirects to prevent SSRF via redirect
      signal: AbortSignal.timeout(5000) // 5s timeout
    })

    return NextResponse.json({
      valid: response.ok || response.status === 301 || response.status === 302,
      status: response.status,
      url: targetUrl
    })
  } catch {
    return NextResponse.json({
      valid: false,
      error: 'Validation failed',
    }, { status: 200 }) // Return 200 with valid: false to not break client
  }
}
