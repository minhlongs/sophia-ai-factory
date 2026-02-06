import { lemonSqueezySetup } from '@lemonsqueezy/lemonsqueezy.js'

export function configureLemonSqueezy() {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY

  if (!apiKey) {
    return
  }

  lemonSqueezySetup({
    apiKey,
    onError: () => {
      // Error handled silently - Lemon Squeezy SDK will throw on API calls
    },
  })
}
