/**
 * Bilingual EN+VI HTML email template with optional CTA button.
 *
 * Wave 22 Phase 07 — DRY refactor across change-email, account-delete, and
 * account-delete-finalize flows. Each adapter supplies pre-translated copy
 * + accent color; this module owns the HTML structure + URL safety check.
 *
 * @module seed/email/bilingual-cta-template
 */

export interface BilingualEmailLocale {
  /** Primary heading rendered as `<h2>` (EN) or `<h3>` (VI). */
  heading: string;
  /** Body paragraphs; each rendered as one `<p>`. */
  paragraphs: string[];
  /** Disclaimer line at end of locale section. */
  footer: string;
  /** CTA button label; only used when `cta` is provided in opts. */
  ctaLabel?: string;
}

export interface BilingualCtaEmailOpts {
  en: BilingualEmailLocale;
  vi: BilingualEmailLocale;
  /** Heading + VI section accent color (e.g., '#6750A4' or '#dc2626'). */
  accentColor: string;
  /** Optional CTA. Omit for informational-only emails (no button). */
  cta?: { url: string; bgColor: string };
}

export function buildBilingualCtaEmail(opts: BilingualCtaEmailOpts): string {
  const { en, vi, cta, accentColor } = opts;
  if (cta && !cta.url.startsWith('https://') && !cta.url.startsWith('http://localhost')) {
    throw new Error(`[bilingual-cta-email] Invalid CTA URL: ${cta.url}`);
  }
  const ctaHtml = cta ? renderCta(cta, en.ctaLabel ?? 'Confirm', vi.ctaLabel ?? 'Xác nhận') : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,sans-serif;line-height:1.6;max-width:600px;margin:0 auto;padding:24px;">
  <h2 style="color:${accentColor}">${escapeHtml(en.heading)}</h2>
  ${renderParagraphs(en.paragraphs)}
  ${ctaHtml}
  <p style="font-size:13px;color:#666;">${escapeHtml(en.footer)}</p>
  <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />
  <h3 style="color:${accentColor};margin-bottom:8px;">${escapeHtml(vi.heading)}</h3>
  ${renderParagraphs(vi.paragraphs)}
  <p style="font-size:13px;color:#666;">${escapeHtml(vi.footer)}</p>
</body></html>`;
}

function renderCta(cta: { url: string; bgColor: string }, enLabel: string, viLabel: string): string {
  const safeUrl = cta.url.replace(/"/g, '&quot;').replace(/</g, '&lt;');
  return `<a href="${safeUrl}" style="display:inline-block;background:${cta.bgColor};color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0;">${escapeHtml(enLabel)} · ${escapeHtml(viLabel)}</a>`;
}

function renderParagraphs(paragraphs: string[]): string {
  return paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n  ');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
