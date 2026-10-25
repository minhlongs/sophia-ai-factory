/**
 * Robots.txt for SEO, AEO & GEO — sophia.agencyos.network
 * Explicitly grants AI Answer Engines access to public surfaces and Dual-Read endpoints
 * while strictly blocking authenticated tenant/dashboard routes.
 */

import type { MetadataRoute } from 'next';

const PROTECTED_DISALLOW = [
  '/dashboard/',
  '/admin/',
  '/auth/',
  '/onboarding/',
  '/welcome/',
  '/redeem/',
  '/payment-success/',
  '/checkout/',
];

const AI_ANSWER_ENGINE_BOTS = [
  'OAI-SearchBot',
  'ChatGPT-User',
  'GPTBot',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-Web',
  'PerplexityBot',
  'Google-Extended',
  'Applebot-Extended',
  'Amazonbot',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: AI_ANSWER_ENGINE_BOTS,
        allow: ['/', '/llms.txt', '/llms-full.txt', '/.well-known/agent.json', '/api/aeo/markdown'],
        disallow: PROTECTED_DISALLOW,
      },
      {
        userAgent: '*',
        allow: ['/', '/llms.txt', '/llms-full.txt', '/.well-known/agent.json', '/api/aeo/markdown'],
        disallow: ['/api/', ...PROTECTED_DISALLOW],
      },
    ],
    host: 'https://sophia.agencyos.network',
    sitemap: 'https://sophia.agencyos.network/sitemap.xml',
  };
}
