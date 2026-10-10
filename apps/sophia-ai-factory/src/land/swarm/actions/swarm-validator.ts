/**
 * swarm-validator.ts — Land Layer
 * Authentication guard, D1 resolution, action wrappers, and input validations for Swarm Actions
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1, type D1Database } from '@/seed/db/client';
import type {
  RegisterSwarmNodeInput,
  HeartbeatTelemetryInput,
  InboundLeadPayload,
  SwarmActionError,
} from '@/seed/types/autonomous-swarm';
import { failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import type { ManualInterventionInput } from './types';

/**
 * Ensures caller is an authenticated user session.
 */
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user || !user.id) {
    throw new Error('UNAUTHORIZED: You must be signed in to perform this swarm operation.');
  }
  return user;
}

/**
 * Resolves active D1 database or throws typed error.
 */
export async function getRequiredD1(): Promise<D1Database> {
  const db = await getD1();
  if (!db) {
    throw new Error('DATABASE_UNAVAILABLE: Cloudflare D1 database binding is unavailable.');
  }
  return db;
}

/**
 * Wraps an authenticated D1 action with standard error handling and logging.
 */
export async function withAuthDbAction<T>(
  actionName: string,
  errorCode: string,
  fn: (db: D1Database) => Promise<Result<T, SwarmActionError>>
): Promise<Result<T, SwarmActionError>> {
  try {
    await requireAuth();
    const db = await getRequiredD1();
    return await fn(db);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[swarm-actions] ${actionName} failed`, { error: message });
    return failure({ code: errorCode, message });
  }
}

/**
 * Wraps an unauthenticated D1 action with standard error handling and logging.
 */
export async function withDbAction<T>(
  actionName: string,
  errorCode: string,
  fn: (db: D1Database) => Promise<Result<T, SwarmActionError>>
): Promise<Result<T, SwarmActionError>> {
  try {
    const db = await getRequiredD1();
    return await fn(db);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[swarm-actions] ${actionName} failed`, { error: message });
    return failure({ code: errorCode, message });
  }
}

/**
 * Validates node registration parameters.
 */
export function validateRegisterNodeInput(input: RegisterSwarmNodeInput): string | null {
  if (!input.nodeName || !input.region || !input.role) {
    return 'nodeName, region, and role are required parameters.';
  }
  return null;
}

/**
 * Validates heartbeat telemetry input.
 */
export function validateHeartbeatInput(input: HeartbeatTelemetryInput): string | null {
  if (!input.nodeId) {
    return 'nodeId is required for heartbeat.';
  }
  return null;
}

/**
 * Validates manual intervention parameters.
 */
export function validateManualInterventionInput(input: ManualInterventionInput): string | null {
  if (!input.customerId || !input.interventionType) {
    return 'customerId and interventionType are required.';
  }
  return null;
}

/**
 * Validates inbound lead payload.
 */
export function validateLeadPayload(payload: InboundLeadPayload): string | null {
  if (!payload.leadEmail || !payload.companyName || !payload.companyDomain) {
    return 'leadEmail, companyName, and companyDomain are required.';
  }
  return null;
}
