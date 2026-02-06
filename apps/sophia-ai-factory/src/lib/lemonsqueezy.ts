import { lemonSqueezySetup } from '@lemonsqueezy/lemonsqueezy.js'

export function configureLemonSqueezy() {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY

  if (!apiKey) {
    console.warn('Warning: LEMONSQUEEZY_API_KEY is missing')
    return
  }

  lemonSqueezySetup({
    apiKey,
    onError: (error) => console.error("Lemon Squeezy API Error:", error),
  })
}
