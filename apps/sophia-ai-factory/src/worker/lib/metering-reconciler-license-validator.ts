import type { Discrepancy } from '@/seed/types/billing-contracts';
import { logger } from '@/lib/utils/logger-utility';
import type { Env } from '../index';
import type { AggregatedUsage, LicenseValidationResult } from './metering-reconciler-types';
import { logErrorToKv } from './metering-reconciler-error-logger';

interface RaasSyncResponse {
  valid?: boolean;
  status?: string;
  tier?: string;
}

/** Validate a single license via RaaS Gateway /api/license/sync endpoint. */
export async function validateLicense(
  licenseNonce: string,
  env: Env
): Promise<LicenseValidationResult> {
  try {
    const raasApiKey = env.AGENCYOS_API_KEY;

    if (!raasApiKey) {
      return { valid: false, error: 'RaaS API key not configured' };
    }

    const response = await fetch('https://raas.agencyos.network/api/license/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${raasApiKey}`,
      },
      body: JSON.stringify({ license_nonce: licenseNonce }),
    });

    if (!response.ok) {
      return {
        valid: false,
        error: `RaaS Gateway error: ${response.status} ${response.statusText}`,
      };
    }

    const data = (await response.json()) as RaasSyncResponse;

    return {
      valid: data.valid === true || data.status === 'active',
      tier: data.tier,
      status: data.status,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error validating license',
    };
  }
}

/** Validate all licenses in the aggregated map. Returns validated map + stats + discrepancies. */
export async function validateAllLicenses(
  aggregated: Map<string, AggregatedUsage>,
  env: Env
): Promise<{
  validatedLicenses: Map<string, LicenseValidationResult>;
  licensesValidated: number;
  errorsLoggedToKv: number;
  discrepancies: Discrepancy[];
}> {
  const validatedLicenses = new Map<string, LicenseValidationResult>();
  let licensesValidated = 0;
  let errorsLoggedToKv = 0;
  const discrepancies: Discrepancy[] = [];

  for (const [key, usage] of aggregated) {
    const validation = await validateLicense(usage.licenseNonce, env);
    validatedLicenses.set(key, validation);
    licensesValidated++;

    if (!validation.valid) {
      logger.warn('[Reconciliation Runner] License validation failed', {
        licenseNonce: usage.licenseNonce.slice(0, 8),
        service: usage.service,
        error: validation.error,
      });

      await logErrorToKv(
        new Error(`License validation failed: ${validation.error}`),
        { licenseNonce: usage.licenseNonce, operation: 'license_validation', timestamp: Date.now() },
        env.KV_KV
      );
      errorsLoggedToKv++;

      discrepancies.push({
        type: 'gateway_discrepancy',
        severity: 'high',
        licenseNonce: usage.licenseNonce,
        userId: usage.userId,
        details: {
          description: validation.error || 'License validation failed',
          source: 'raas_gateway',
        },
        timestamp: Date.now(),
      });
    }
  }

  return { validatedLicenses, licensesValidated, errorsLoggedToKv, discrepancies };
}
