export function parseDate(value: string | number | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return new Date(value * 1000);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDate(value: string | number | null | undefined, locale: string): string {
  const date = parseDate(value);
  if (!date) return '—';
  return date.toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function daysSince(value: string | number | null | undefined): number | null {
  const date = parseDate(value);
  if (!date) return null;
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return 0;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
