/**
 * @file time-converter.ts
 * @layer tree/publishing/apac
 * @description Date/time extraction, UTC conversion, and formatting across APAC timezones.
 */

export function getZonedDateParts(
  timestampMs: number,
  timeZone: string
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  let targetTz = timeZone;
  let formatter: Intl.DateTimeFormat;

  try {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: targetTz,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    });
  } catch {
    targetTz = 'UTC';
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    });
  }

  const parts: Record<string, string> = {};
  formatter.formatToParts(new Date(timestampMs)).forEach((p) => {
    parts[p.type] = p.value;
  });

  return {
    year: parseInt(parts.year ?? '1970', 10),
    month: parseInt(parts.month ?? '1', 10),
    day: parseInt(parts.day ?? '1', 10),
    hour: parseInt(parts.hour ?? '0', 10) % 24,
    minute: parseInt(parts.minute ?? '0', 10),
    second: parseInt(parts.second ?? '0', 10),
  };
}

export function convertLocalToUtcMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number = 0,
  utcOffsetHours: number = 0
): number {
  return (
    Date.UTC(year, month - 1, day, hour, minute, second) -
    utcOffsetHours * 3600 * 1000
  );
}

export function formatLocalPeakTime(timestampMs: number, timezone: string): string {
  const parts = getZonedDateParts(timestampMs, timezone);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)} ${pad(parts.hour)}:${pad(parts.minute)} (${timezone})`;
}
