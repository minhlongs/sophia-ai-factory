/**
 * Tree-level email rendering — re-export from forest for backward compat.
 */
export { renderEmail } from '@/forest/email/render-email';
export type { RenderEmailResult, TemplateKey, TemplateDataMap } from '@/forest/email/render-email';
export { SENDER_FROM, BRAND_COLOR, BASE_URL, SUPPORT_EMAIL, htmlWrapper } from '@/forest/email/templates/shared-layout';
