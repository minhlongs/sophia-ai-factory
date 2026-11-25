/**
 * Public 1-Link Bio Storefront Hub (`/hub/[handle]`) for Crypto + SaaS Affiliates.
 *
 * @module app/hub/[handle]/page
 */

import { notFound } from 'next/navigation';
import {
  buildDefaultStorefrontHub,
  buildStorefrontHubJsonLd,
  SAFE_HUB_HANDLE_RE,
} from '@/tree/aeo/storefront-hub-builder';

const DEFAULT_CF_BASE_URL = 'https://sophia-ai-factory.agencyos-openclaw.workers.dev';

export default async function AffiliateStorefrontHubPage(props: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await props.params;
  if (!SAFE_HUB_HANDLE_RE.test(handle)) {
    notFound();
  }

  const baseUrl = (
    process.env.APP_URL ||
    process.env.WORKER_TECHNICAL_URL ||
    DEFAULT_CF_BASE_URL
  ).replace(/\/$/, '');

  const profile = buildDefaultStorefrontHub(handle, baseUrl);
  const escapedJsonLd = buildStorefrontHubJsonLd(profile, baseUrl);

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-6 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: escapedJsonLd }}
      />

      <header className="space-y-2 border-b border-border pb-6 text-center">
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Sophia Verified Storefront Hub • Crypto &amp; SaaS
        </p>
        <h1 className="text-2xl font-bold text-foreground">{profile.displayName}</h1>
        <p className="text-sm text-muted-foreground">{profile.bio}</p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <a
            href={profile.telegramConciergeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
          >
            Chat 1-on-1 with @Sophia_Bbot Concierge
          </a>
          <a
            href={`/hub/${handle}/md`}
            className="rounded-lg border border-border bg-background px-4 py-2 text-xs font-medium text-foreground hover:bg-muted"
          >
            Markdown (.md) for AI Agents
          </a>
        </div>
      </header>

      <section className="space-y-4">
        {profile.items.map((item) => (
          <article
            key={item.slug}
            className="space-y-2 rounded-xl border border-border bg-card p-5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-full bg-muted px-2.5 py-0.5 font-mono text-[11px] uppercase text-muted-foreground">
                {item.vertical} • {item.disclosureTag}
              </span>
              <a
                href={`/c/${item.slug}`}
                className="text-xs font-medium text-primary hover:underline"
              >
                Full GEO Review →
              </a>
            </div>
            <h2 className="text-base font-semibold text-foreground">{item.title}</h2>
            <p className="text-xs text-muted-foreground">{item.summary}</p>
            <div className="pt-1">
              <a
                href={item.shortUrl}
                className="inline-block rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
              >
                {item.ctaText}
              </a>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
