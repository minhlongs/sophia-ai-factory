/**
 * White-label email formatter types and constants.
 *
 * Layer: tree/branding/styler
 * Allowed imports: @/seed/*
 */

export interface WhiteLabelEmailBranding {
  /** Custom agency display name */
  agencyName?: string | null;
  /** Custom agency logo image URL */
  logoUrl?: string | null;
  /** Primary brand color (hex, e.g. '#6366f1') */
  primaryColor?: string | null;
  /** Secondary/accent brand color */
  accentColor?: string | null;
  /** Custom agency customer support email */
  supportEmail?: string | null;
  /** Agency custom domain */
  customDomain?: string | null;
  /** Legal entity disclaimer or registered address */
  legalDisclaimer?: string | null;
  /** Unbranded unsubscribe link */
  unsubscribeUrl?: string | null;
  /** Markdown/text footer notes */
  emailFooter?: string | null;
  /** Sender display name (e.g. 'Apex Media') */
  emailFromName?: string | null;
  /** Explicit opt-in for platform watermark (default: false in MASTER tier) */
  poweredBySophia?: boolean;
}

export interface EmailFormatOptions {
  /** Document locale: 'vi' or 'en' */
  locale?: 'vi' | 'en';
  /** Inbox preview preheader snippet */
  preheaderText?: string;
  /** Max container width in pixels (default 580) */
  containerWidth?: number;
}

export const DEFAULT_PRIMARY_COLOR = '#7c3aed';
export const DEFAULT_BG_COLOR = '#09090b';
export const DEFAULT_CONTAINER_BG = '#18181b';
export const DEFAULT_TEXT_COLOR = '#e4e4e7';
export const DEFAULT_MUTED_COLOR = '#a1a1aa';
