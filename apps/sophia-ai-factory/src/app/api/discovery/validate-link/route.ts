import { NextResponse } from 'next/server'

// Use Edge Runtime for low latency
export const runtime = 'edge'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const targetUrl = searchParams.get('url')

  if (!targetUrl) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  }

  try {
    // Perform a HEAD request to check availability without downloading body
    const response = await fetch(targetUrl, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Sophia-Link-Validator/1.0'
      },
      signal: AbortSignal.timeout(5000) // 5s timeout
    })

    return NextResponse.json({
      valid: response.ok,
      status: response.status,
      url: targetUrl
    })
  } catch (error) {
    return NextResponse.json({
      valid: false,
      error: 'Validation failed',
      details: (error as Error).message
    }, { status: 200 }) // Return 200 with valid: false to not break client
  }
}
