/**
 * Autonomous Engine Edge-Safe Cron Expression Parser
 *
 * Layer: tree/autonomous (Pure domain engine, zero external npm dependencies)
 * Conforms to: Sophia 4-Layer Architecture Doctrine
 *
 * @module tree/autonomous/cron-parser
 */

import type { CronFieldMatchRules } from '@/seed/types/autonomous-engine';
import { parseSingleSubExpression } from './cron-subexpression-parser';

const MAX_CRON_EXPRESSION_LENGTH = 256;

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
  for (const sub of fieldStr.split(',')) {
    const trimmed = sub.trim();
    if (trimmed) {
      parseSingleSubExpression(trimmed, fieldStr, min, max, isDayOfWeek, result);
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
  if (expression.length > MAX_CRON_EXPRESSION_LENGTH) {
    throw new Error(`Cron expression exceeds the ${MAX_CRON_EXPRESSION_LENGTH}-character limit`);
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
