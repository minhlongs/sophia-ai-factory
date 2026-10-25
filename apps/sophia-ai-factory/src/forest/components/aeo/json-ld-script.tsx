/**
 * Server Component rendering Schema.org JSON-LD @graph with CSP nonce support.
 * Layer: forest/components/aeo
 */

import { getCspNonce } from '@/seed/security/get-csp-nonce';
import type { DualReadPagePayload } from '@/seed/aeo';
import { buildJsonLdGraph } from '@/tree/aeo';

export interface JsonLdScriptProps {
  readonly payload: DualReadPagePayload;
}

export async function JsonLdScript({ payload }: JsonLdScriptProps) {
  const nonce = await getCspNonce();
  const graphDocument = buildJsonLdGraph(payload);

  return (
    <script
      id={`aeo-jsonld-${payload.pageKey}`}
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(graphDocument).replace(/</g, '\\u003c'),
      }}
    />
  );
}
