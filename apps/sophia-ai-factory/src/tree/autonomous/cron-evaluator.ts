/**
 * Autonomous Engine Edge-Safe Cron & Schedule Evaluator
 *
 * Layer: tree/autonomous (Pure domain engine, zero external npm dependencies)
 * Conforms to: Sophia 4-Layer Architecture Doctrine & Cloudflare Edge Runtime
 *
 * @module tree/autonomous/cron-evaluator
 */

import { parseCronExpression, parseField } from './cron-parser';
import { getZonedParts, type ZonedDateParts } from './cron-timezone';

export { parseCronExpression, parseField, getZonedParts, type ZonedDateParts };
export { calculateNextIntervalRun, isTaskDue } from './task-schedule-evaluator';

/**
 * Evaluates whether a given date matches a cron expression at minute precision.
 */
export function isCronDue(
  expression: string,
  fromDate: Date = new Date(),
  targetTimezone = 'UTC'
): boolean {
  const rules = parseCronExpression(expression);
  const parts = getZonedParts(fromDate, targetTimezone);

  return (
    rules.minute.includes(parts.minute) &&
    rules.hour.includes(parts.hour) &&
    rules.dayOfMonth.includes(parts.dayOfMonth) &&
    rules.month.includes(parts.month) &&
    rules.dayOfWeek.includes(parts.dayOfWeek)
  );
}

/**
 * Calculates the next matching Date strictly after fromDate for a cron expression.
 * Iterates efficiently up to a 5-year safety horizon.
 */
export function calculateNextCronRun(
  expression: string,
  fromDate: Date = new Date(),
  targetTimezone = 'UTC'
): Date {
  const rules = parseCronExpression(expression);

  // Start at next minute boundary
  let currentMs = Math.floor(fromDate.getTime() / 60000) * 60000 + 60000;
  const maxSearchHorizonMs = currentMs + 5 * 366 * 24 * 60 * 60 * 1000;

  while (currentMs < maxSearchHorizonMs) {
    const candidate = new Date(currentMs);
    const parts = getZonedParts(candidate, targetTimezone);

    // Fast-forward day if month or day does not match
    if (
      !rules.month.includes(parts.month) ||
      !rules.dayOfMonth.includes(parts.dayOfMonth) ||
      !rules.dayOfWeek.includes(parts.dayOfWeek)
    ) {
      const minutesToNextDay = (24 - parts.hour) * 60 - parts.minute;
      currentMs += Math.max(1, minutesToNextDay) * 60000;
      continue;
    }

    // Fast-forward hour if hour does not match
    if (!rules.hour.includes(parts.hour)) {
      const minutesToNextHour = 60 - parts.minute;
      currentMs += Math.max(1, minutesToNextHour) * 60000;
      continue;
    }

    // Check minutes in matching hour
    const nextMatchingMinute = rules.minute.find((m) => m >= parts.minute);
    if (nextMatchingMinute !== undefined) {
      if (nextMatchingMinute === parts.minute) {
        return candidate;
      }
      currentMs += (nextMatchingMinute - parts.minute) * 60000;
      continue;
    }

    // No further matching minutes in this hour; advance to next hour
    const minutesToNextHour = 60 - parts.minute;
    currentMs += Math.max(1, minutesToNextHour) * 60000;
  }

  throw new Error(
    `No matching cron run found within 5 years for expression '${expression}'`
  );
}
