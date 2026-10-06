/**
 * Autonomous Engine Timezone Helper
 *
 * Layer: tree/autonomous (Pure domain engine, zero external npm dependencies)
 * Conforms to: Sophia 4-Layer Architecture Doctrine & Cloudflare Edge Runtime
 *
 * @module tree/autonomous/cron-timezone
 */

export interface ZonedDateParts {
  minute: number;
  hour: number;
  dayOfMonth: number;
  month: number;
  dayOfWeek: number;
  year: number;
}

/**
 * Extracts date parts in target timezone using standard Intl API.
 */
export function getZonedParts(date: Date, timeZone = 'UTC'): ZonedDateParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: string): number => {
    const p = parts.find((x) => x.type === type);
    return p ? parseInt(p.value, 10) : 0;
  };

  const year = getPart('year');
  const month = getPart('month');
  const dayOfMonth = getPart('day');
  let hour = getPart('hour');
  if (hour === 24) hour = 0; // Some engines format midnight as 24
  const minute = getPart('minute');

  // Derive day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  const dayOfWeek = new Date(Date.UTC(year, month - 1, dayOfMonth)).getUTCDay();

  return { minute, hour, dayOfMonth, month, dayOfWeek, year };
}
