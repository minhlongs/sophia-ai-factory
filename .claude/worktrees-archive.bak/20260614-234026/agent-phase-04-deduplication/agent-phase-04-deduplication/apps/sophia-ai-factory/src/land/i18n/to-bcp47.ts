/**
 * Convert next-intl locale code (`vi`/`en`) to BCP-47 tag for `Intl.*` APIs.
 * Wave-10 Q4: extracted from 3+ duplicates of
 *   `locale === 'vi' ? 'vi-VN' : 'en-US'`
 * across mission-dashboard, mission-detail, dunning-status-banner.
 */
export function toBcp47(locale: string | undefined | null): string {
  return locale === 'vi' ? 'vi-VN' : 'en-US';
}
