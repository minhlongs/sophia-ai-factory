import { Polar } from '@polar-sh/sdk'
import { Webhook } from 'standardwebhooks'

if (!process.env.POLAR_ACCESS_TOKEN) {
  console.warn('Warning: POLAR_ACCESS_TOKEN is missing')
}

// Initialize the Polar SDK
export const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN || 'dummy_token_for_build',
  server: process.env.NODE_ENV === 'development' ? 'sandbox' : 'production',
})

// Webhook verification helper
export const verifyWebhookSignature = (
  payload: string,
  headers: Headers,
  secret: string
) => {
  const wh = new Webhook(secret)
  // Convert Headers to Record<string, string> for standardwebhooks
  const headersRecord: Record<string, string> = {}
  headers.forEach((value, key) => {
    headersRecord[key] = value
  })

  return wh.verify(payload, headersRecord)
}
