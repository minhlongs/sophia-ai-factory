/**
 * Affiliate Landing Page CRO, Disclosure & Static CWV Preflight Linter.
 *
 * Clean-room pure-TS engine (MIT/Apache-2.0 patterns from rviscomi/capo.js,
 * frontend-performance/perf-audit, FTC .com Disclosures, and EU DSA Art. 26):
 * audits landing page HTML statically in 0ms on Cloudflare Workers.
 *
 * Layer: seed/aeo (pure deterministic HTML inspection, zero external deps)
 *
 * @module seed/aeo/landing-preflight-linter
 */

export interface LandingPreflightReport {
  readonly score100: number;
  readonly grade: 'A' | 'B' | 'C' | 'D' | 'F';
  readonly hasAffiliateDisclosure: boolean;
  readonly hasJsonLd: boolean;
  readonly findings: readonly string[];
}

const DISCLOSURE_REGEX =
  /\b(?:affiliate\s+disclosure|paid\s+partnership|commission\s+at\s+no\s+extra\s+cost|#ad|#affiliate|liên\s+kết\s+tiếp\s+thị|hoa\s+hồng\s+tiếp\s+thị)\b/i;

export function lintAffiliateLandingHtml(html: string): LandingPreflightReport {
  const findings: string[] = [];
  let score = 100;

  const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);
  if (!hasViewport) {
    score -= 15;
    findings.push('Missing mobile viewport meta tag');
  }

  const hasAffiliateDisclosure = DISCLOSURE_REGEX.test(html);
  if (!hasAffiliateDisclosure) {
    score -= 25;
    findings.push('Missing FTC/DSA affiliate disclosure before outbound click');
  }

  const hasJsonLd = /<script[^>]+type=["']application\/ld\+json["']/i.test(html);
  if (!hasJsonLd) {
    score -= 15;
    findings.push('Missing Schema.org JSON-LD structured data');
  }

  const hasBlockingScriptInHead = /<head[\s\S]*?<script(?![^>]*(?:async|defer|type=["']application\/ld\+json["']))[^>]*src=/i.test(html);
  if (hasBlockingScriptInHead) {
    score -= 15;
    findings.push('Render-blocking <script src> detected inside <head>');
  }

  const clamped = Math.max(0, score);
  const grade =
    clamped >= 90 ? 'A' : clamped >= 80 ? 'B' : clamped >= 70 ? 'C' : clamped >= 60 ? 'D' : 'F';

  return {
    score100: clamped,
    grade,
    hasAffiliateDisclosure,
    hasJsonLd,
    findings,
  };
}
