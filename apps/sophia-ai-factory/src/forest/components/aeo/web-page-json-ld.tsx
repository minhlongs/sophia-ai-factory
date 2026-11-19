/**
 * Lightweight Server Component rendering Schema.org WebPage / CollectionPage JSON-LD.
 * Layer: forest/components/aeo
 */

import { getCspNonce } from '@/seed/security/get-csp-nonce';
import { SOPHIA_BASE_URL } from '@/seed/aeo';

export interface WebPageJsonLdProps {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly path: string;
  readonly locale: string;
  readonly schemaType?: 'WebPage' | 'CollectionPage' | 'AboutPage';
  readonly staticRender?: boolean;
}

export async function WebPageJsonLd({
  id,
  title,
  description,
  path,
  locale,
  schemaType = 'WebPage',
  staticRender = false,
}: WebPageJsonLdProps) {
  const nonce = staticRender ? undefined : await getCspNonce();
  const normalizedLocale = locale === 'en' ? 'en' : 'vi';
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${SOPHIA_BASE_URL}/${normalizedLocale}${normalizedPath === '/' ? '' : normalizedPath}`;

  const schema = {
    '@context': 'https://schema.org',
    '@type': schemaType,
    name: title,
    description,
    url,
    inLanguage: normalizedLocale === 'vi' ? 'vi-VN' : 'en-US',
    isPartOf: {
      '@type': 'WebSite',
      name: 'Sophia AI Factory',
      url: SOPHIA_BASE_URL,
    },
  };

  return (
    <script
      id={`webpage-jsonld-${id}`}
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(schema).replace(/</g, '\\u003c'),
      }}
    />
  );
}
