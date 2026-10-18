/**
 * Cron Sub-Expression Parser Helpers
 *
 * Layer: tree/autonomous (Pure domain engine, zero external npm dependencies)
 *
 * @module tree/autonomous/cron-subexpression-parser
 */

function parseStepBounds(rangePart: string, fieldStr: string, min: number, max: number): [number, number] {
  if (rangePart === '*') return [min, max];
  if (rangePart.includes('-')) {
    const [rangeStart, rangeEnd] = rangePart.split('-').map((v) => parseInt(v, 10));
    if (isNaN(rangeStart) || isNaN(rangeEnd)) {
      throw new Error(`Invalid range '${rangePart}' in cron field '${fieldStr}'`);
    }
    return [rangeStart, rangeEnd];
  }
  const start = parseInt(rangePart, 10);
  if (isNaN(start)) {
    throw new Error(`Invalid range start '${rangePart}' in cron field '${fieldStr}'`);
  }
  return [start, max];
}

function addCronValue(result: Set<number>, rawVal: number, min: number, max: number, isDayOfWeek: boolean): void {
  const val = isDayOfWeek && rawVal === 7 ? 0 : rawVal;
  if (val >= min && val <= max) {
    result.add(val);
  }
}

function parseStepSubExpression(
  trimmed: string,
  fieldStr: string,
  min: number,
  max: number,
  isDayOfWeek: boolean,
  result: Set<number>,
): void {
  const [rangePart, stepPart] = trimmed.split('/');
  const step = parseInt(stepPart, 10);
  if (isNaN(step) || step <= 0) {
    throw new Error(`Invalid step value '${stepPart}' in cron field '${fieldStr}'`);
  }
  const [start, end] = parseStepBounds(rangePart, fieldStr, min, max);
  for (let i = start; i <= end; i += step) {
    addCronValue(result, i, min, max, isDayOfWeek);
  }
}

function parseRangeSubExpression(
  trimmed: string,
  fieldStr: string,
  min: number,
  max: number,
  isDayOfWeek: boolean,
  result: Set<number>,
): void {
  const [rangeStart, rangeEnd] = trimmed.split('-').map((v) => parseInt(v, 10));
  if (isNaN(rangeStart) || isNaN(rangeEnd) || rangeStart > rangeEnd) {
    throw new Error(`Invalid range '${trimmed}' in cron field '${fieldStr}'`);
  }
  for (let i = rangeStart; i <= rangeEnd; i++) {
    addCronValue(result, i, min, max, isDayOfWeek);
  }
}

export function parseSingleSubExpression(
  trimmed: string,
  fieldStr: string,
  min: number,
  max: number,
  isDayOfWeek: boolean,
  result: Set<number>,
): void {
  if (trimmed.includes('/')) {
    parseStepSubExpression(trimmed, fieldStr, min, max, isDayOfWeek, result);
    return;
  }
  if (trimmed.includes('-')) {
    parseRangeSubExpression(trimmed, fieldStr, min, max, isDayOfWeek, result);
    return;
  }
  if (trimmed === '*') {
    for (let i = min; i <= max; i++) {
      result.add(isDayOfWeek && i === 7 ? 0 : i);
    }
    return;
  }
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
