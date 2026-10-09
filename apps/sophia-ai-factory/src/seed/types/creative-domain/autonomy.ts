/**
 * @file autonomy.ts
 * @description Autonomy level type and utility helpers for creative agents and workspaces.
 * @layer seed
 */

export type AutonomyLevel = 0 | 1 | 2 | 3 | 4;

export function isAutonomyLevel(value: unknown): value is AutonomyLevel {
  return typeof value === 'number' && [0, 1, 2, 3, 4].includes(value);
}

export function clampAutonomyLevel(level: number): AutonomyLevel {
  const clamped = Math.max(0, Math.min(4, Math.round(level)));
  return clamped as AutonomyLevel;
}
