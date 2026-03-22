/**
 * Interactive API reference — /docs/api
 *
 * Renders the OpenAPI 3.1 spec via Scalar API Reference (CDN, no npm install).
 * Static page; no auth required.
 */

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'API Reference — Sophia AI Factory',
  description:
    'Interactive REST API documentation for the Sophia AI Factory RaaS platform. ' +
    'Submit AI missions, poll results, and integrate with webhooks.',
  openGraph: {
    title: 'Sophia AI Factory API Reference',
    description: 'Full REST API documentation for the RaaS platform.',
    type: 'website',
  },
};

export default function ApiDocsPage() {
  return (
    <>
      {/* Scalar renders into <api-reference> custom element */}
      {/* @ts-expect-error custom element not in JSX intrinsics */}
      <api-reference
        spec-url="/openapi.yaml"
        data-theme="dark"
        data-layout="modern"
        data-hide-download-button="false"
        style={{ display: 'block', minHeight: '100vh' }}
      />

      {/* Scalar CDN — no npm dependency */}
      <script
        src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@latest/dist/browser/standalone.min.js"
        crossOrigin="anonymous"
        async
      />
    </>
  );
}
