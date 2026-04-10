/**
 * Robots.txt for SEO — sophia.agencyos.network
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
        ],
      },
    ],
    sitemap: 'https://sophia.agencyos.network/sitemap.xml',
  };
}
