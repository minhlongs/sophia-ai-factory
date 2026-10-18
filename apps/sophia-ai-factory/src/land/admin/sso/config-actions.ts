'use server';

import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import type {
  EnterpriseSsoConfig,
  CreateEnterpriseSsoInput,
  SsoActionError,
} from '@/seed/types/enterprise-sso';
import {
  getEnterpriseSsoByOrg,
  saveEnterpriseSsoConfig,
  deleteEnterpriseSsoConfig,
} from '@/tree/sso/enterprise-sso-service';
import { assertEnterpriseSsoAccess } from './auth-guard';
import {
  recordSsoConfigSavedAudit,
  recordSsoConfigDeletedAudit,
  mapSaveSsoConfigError,
} from './config-action-helpers';

/**
 * Retrieve all SSO configurations for an organization.
 */
export async function getEnterpriseSsoConfigsAction(
  orgId: string,
): Promise<Result<EnterpriseSsoConfig[], SsoActionError>> {
  const db = await getD1();
  if (!db) {
    return failure({ code: 'INTERNAL_ERROR', message: 'Database binding unavailable' });
  }

  const auth = await assertEnterpriseSsoAccess(db, orgId);
  if (!auth.ok) {
    return auth;
  }

  try {
    const configs = await getEnterpriseSsoByOrg(db, orgId);
    return success(configs);
  } catch (err) {
    logger.error('[enterprise-sso-actions] Failed to list SSO configs', {
      orgId,
      error: err instanceof Error ? err.message : String(err),
    });
    return failure({ code: 'INTERNAL_ERROR', message: 'Failed to retrieve SSO configurations' });
  }
}

/**
 * Create or update an Enterprise SSO configuration.
 */
export async function saveEnterpriseSsoConfigAction(
  input: CreateEnterpriseSsoInput,
): Promise<Result<EnterpriseSsoConfig, SsoActionError>> {
  const db = await getD1();
  if (!db) {
    return failure({ code: 'INTERNAL_ERROR', message: 'Database binding unavailable' });
  }

  const auth = await assertEnterpriseSsoAccess(db, input.orgId);
  if (!auth.ok) {
    return auth;
  }

  try {
    const saved = await saveEnterpriseSsoConfig(db, input);
    await recordSsoConfigSavedAudit(db, input.orgId, auth.value, saved);
    return success(saved);
  } catch (err) {
    return mapSaveSsoConfigError(input.orgId, err);
  }
}

/**
 * Delete an Enterprise SSO configuration.
 */
export async function deleteEnterpriseSsoConfigAction(
  orgId: string,
  configId: string,
): Promise<Result<boolean, SsoActionError>> {
  const db = await getD1();
  if (!db) {
    return failure({ code: 'INTERNAL_ERROR', message: 'Database binding unavailable' });
  }

  const auth = await assertEnterpriseSsoAccess(db, orgId);
  if (!auth.ok) {
    return auth;
  }

  try {
    const deleted = await deleteEnterpriseSsoConfig(db, configId, orgId);
    if (deleted) {
      await recordSsoConfigDeletedAudit(db, orgId, auth.value, configId);
    }
    return success(deleted);
  } catch (err) {
    logger.error('[enterprise-sso-actions] Failed to delete SSO config', {
      orgId,
      configId,
      error: err instanceof Error ? err.message : String(err),
    });
    return failure({ code: 'INTERNAL_ERROR', message: 'Failed to delete SSO configuration' });
  }
}
