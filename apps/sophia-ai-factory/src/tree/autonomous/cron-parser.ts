/**
 * Autonomous Engine Edge-Safe Cron Expression Parser
 *
 * Layer: tree/autonomous (Pure domain engine, zero external npm dependencies)
 * Conforms to: Sophia 4-Layer Architecture Doctrine
 *
 * @module tree/autonomous/cron-parser
 */

import type { CronFieldMatchRules } from '@/seed/types/autonomous-engine';

/**
 * Parses a single cron field into an array of matched integer values.
 * Supports: '*', exact '5', list '1,2,5', range '1-5', step '* /5' or '1-10/2'.
 */
export function parseField(
  fieldStr: string,
  min: number,
  max: number,
  isDayOfWeek = false
): number[] {
  const result = new Set<number>();
  const subExpressions = fieldStr.split(',');

  for (const sub of subExpressions) {
    const trimmed = sub.trim();
    if (!trimmed) continue;

    if (trimmed.includes('/')) {
      const [rangePart, stepPart] = trimmed.split('/');
      const step = parseInt(stepPart, 10);
      if (isNaN(step) || step <= 0) {
        throw new Error(`Invalid step value '${stepPart}' in cron field '${fieldStr}'`);
      }

      let start = min;
      let end = max;

      if (rangePart !== '*') {
        if (rangePart.includes('-')) {
          const [rangeStart, rangeEnd] = rangePart.split('-').map((v) => parseInt(v, 10));
          if (isNaN(rangeStart) || isNaN(rangeEnd)) {
            throw new Error(`Invalid range '${rangePart}' in cron field '${fieldStr}'`);
          }
          start = rangeStart;
          end = rangeEnd;
        } else {
          start = parseInt(rangePart, 10);
          if (isNaN(start)) {
            throw new Error(`Invalid range start '${rangePart}' in cron field '${fieldStr}'`);
          }
        }
      }

      for (let i = start; i <= end; i += step) {
        let val = i;
        if (isDayOfWeek && val === 7) val = 0;
        if (val >= min && val <= max) {
          result.add(val);
        }
      }
    } else if (trimmed.includes('-')) {
      const [rangeStart, rangeEnd] = trimmed.split('-').map((v) => parseInt(v, 10));
      if (isNaN(rangeStart) || isNaN(rangeEnd) || rangeStart > rangeEnd) {
        throw new Error(`Invalid range '${trimmed}' in cron field '${fieldStr}'`);
      }
      for (let i = rangeStart; i <= rangeEnd; i++) {
        let val = i;
        if (isDayOfWeek && val === 7) val = 0;
        if (val >= min && val <= max) {
          result.add(val);
        }
      }
    } else if (trimmed === '*') {
      for (let i = min; i <= max; i++) {
        let val = i;
        if (isDayOfWeek && val === 7) val = 0;
        result.add(val);
      }
    } else {
      let val = parseInt(trimmed, 10);
      if (isNaN(val)) {
        throw new Error(`Invalid value '${trimmed}' in cron field '${fieldStr}'`);
      }
      if (isDayOfWeek && val === 7) val = 0;
      if (val < min || val > max) {
        throw new Error(`Value '${val}' out of bounds [${min}, ${max}] in cron field '${fieldStr}'`);
      }
      result.add(val);
    }
  }

  const sorted = Array.from(result).sort((a, b) => a - b);
  if (sorted.length === 0) {
    throw new Error(`Cron field '${fieldStr}' resolved to zero valid values`);
  }
  return sorted;
}

/**
 * Parses a standard 5-field cron expression into match rules.
 * Syntax: `minute hour dayOfMonth month dayOfWeek`
 * Throws an Error if the expression is invalid.
 */
export function parseCronExpression(expression: string): CronFieldMatchRules {
  if (!expression || typeof expression !== 'string') {
    throw new Error('Cron expression must be a non-empty string');
  }

  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) {
    throw new Error(
      `Invalid cron expression '${expression}': expected 5 fields, got ${fields.length}`
    );
  }

  const [minuteStr, hourStr, dayOfMonthStr, monthStr, dayOfWeekStr] = fields;

  return {
    minute: parseField(minuteStr, 0, 59),
    hour: parseField(hourStr, 0, 23),
    dayOfMonth: parseField(dayOfMonthStr, 1, 31),
    month: parseField(monthStr, 1, 12),
    dayOfWeek: parseField(dayOfWeekStr, 0, 7, true),
  };
}
