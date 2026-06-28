/**
 * Robots.txt for SEO — sophia.agencyos.network
 * Canonical block: allow public marketing pages, block all auth-gated routes.
 */

import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/dashboard/',
          '/setup-wizard/',
          '/admin/',
          '/auth/',
          '/onboarding/',
          '/welcome/',
          '/redeem/',
          '/payment-success/',
          '/checkout/',
        ],
      },
    ],
    sitemap: 'https://sophia.agencyos.network/sitemap.xml',
  };
}
