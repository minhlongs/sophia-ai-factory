/**
 * Command Registry — Registers and dispatches mission handlers
 * Layer: forest
 * Purpose: Central registry for all mission commands and their handlers
 */

import type { MissionDefinition, MissionContext, MissionHandlerResult } from './types';

/**
 * Global registry storage
 */
const registry = new Map<string, MissionDefinition>();

/**
 * Register a mission handler
 */
export function registerMission(def: MissionDefinition): void {
  if (registry.has(def.command)) {
    throw new Error(`Mission command "${def.command}" is already registered`);
  }
  registry.set(def.command, def);
}

/**
 * Get a mission definition by command
 */
export function getMission(command: string): MissionDefinition | undefined {
  return registry.get(command);
}

/**
 * Execute a mission by command name
 */
export async function executeMission(
  ctx: MissionContext
): Promise<MissionHandlerResult> {
  const def = registry.get(ctx.command);
  if (!def) {
    return {
      ok: false,
      error: `Unknown mission command: ${ctx.command}`,
      errorCode: 'unknown_command',
    };
  }

  try {
    const result = await def.handler(ctx);
    return result;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Handler failed',
      errorCode: 'handler_error',
    };
  }
}

/**
 * List all registered commands
 */
export function listCommands(): string[] {
  return Array.from(registry.keys());
}

/**
 * Clear the registry (useful for testing)
 */
export function clearRegistry(): void {
  registry.clear();
}
