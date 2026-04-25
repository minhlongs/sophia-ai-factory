/**
 * Dunning status DB query helpers
 *
 * Encapsulates database queries for dunning status listing,
 * including license info and user email joins.
 */

import { createServerClient } from '@/lib/db/client';
import { z } from 'zod';
import type { DunningState } from '@/lib/billing/dunning-workflow';

/**
 * Query params validation schema
 */
export const dunningListSchema = z.object({
  status: z.enum(['current', 'past_due', 'delinquent', 'suspended']).optional(),
  license_id: z.string().max(100).optional(),
  date_from: z.string().max(20).optional(),
  date_to: z.string().max(20).optional(),
  page: z.coerce.number().int().positive().max(1000).default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

/**
 * Action validation schema for POST
 */
export const dunningActionSchema = z.object({
  licenseNonce: z.string().min(1),
  action: z.enum(['suspend', 'restore']),
  reason: z.string().min(1).max(500),
});

/**
 * Dunning status record with license info
 */
export interface DunningStatusRecord {
  id: string;
  licenseNonce: string;
  userId: string;
  state: DunningState;
  gracePeriodDays: number;
  maxRetryAttempts: number;
  failedPaymentCount: number;
  nextRetryAt: string | null;
  polarCustomerId: string | null;
  stripeCustomerId: string | null;
  stateChangedAt: string;
  createdAt: string;
  updatedAt: string;
  // License info join
  licenseTier?: string;
  licenseStatus?: string;
  userEmail?: string;
}

interface DunningRow {
  id: string;
  license_nonce: string;
  user_id: string;
  dunning_state: string;
  grace_period_days: number;
  max_retry_attempts: number;
  polar_customer_id: string | null;
  stripe_customer_id: string | null;
  dunning_state_changed_at: string;
  created_at: string;
  updated_at: string;
}

interface LicenseInfo {
  license_nonce: string;
  tier: string;
  status: string;
}

interface UserInfo {
  user_id: string;
  email: string;
}

export type DunningListParams = z.infer<typeof dunningListSchema>;

/**
 * Fetch dunning records with pagination and optional filters.
 * Returns raw rows + count.
 */
export async function fetchDunningRows(
  params: DunningListParams,
  db: ReturnType<typeof createServerClient>
): Promise<{ rows: DunningRow[]; count: number | null; error: unknown }> {
  let query = db
    .from('dunning_settings')
    .select('*', { count: 'exact' });

  if (params.status) {
    query = query.eq('dunning_state', params.status);
  }
  if (params.license_id) {
    query = query.ilike('license_nonce', `%${params.license_id}%`);
  }
  if (params.date_from) {
    query = query.gte('updated_at', new Date(params.date_from).toISOString());
  }
  if (params.date_to) {
    query = query.lte('updated_at', new Date(params.date_to).toISOString());
  }

  const from = (params.page - 1) * params.limit;
  const to = from + params.limit - 1;
  query = query.range(from, to).order('updated_at', { ascending: false });

  const { data, error, count } = await query;
  return { rows: (data as unknown as DunningRow[]) || [], count: count ?? null, error };
}

/**
 * Enrich dunning rows with license tier/status and user email.
 */
export async function enrichDunningRows(
  rows: DunningRow[],
  db: ReturnType<typeof createServerClient>
): Promise<DunningStatusRecord[]> {
  const licenseNonces = rows.map((d) => d.license_nonce);
  const userIds = rows.map((d) => d.user_id);

  let licenseInfo: LicenseInfo[] = [];
  let userInfo: UserInfo[] = [];

  if (licenseNonces.length > 0) {
    const { data } = await db
      .from('raas_api_keys')
      .select('license_nonce, tier, status')
      .in('license_nonce', licenseNonces);
    licenseInfo = (data as unknown as LicenseInfo[]) || [];
  }

  if (userIds.length > 0) {
    const { data } = await db
      .from('user_profiles')
      .select('user_id, email')
      .in('user_id', userIds);
    userInfo = (data as unknown as UserInfo[]) || [];
  }

  return rows.map((d) => {
    const lic = licenseInfo.find((l) => l.license_nonce === d.license_nonce);
    const usr = userInfo.find((u) => u.user_id === d.user_id);

    return {
      id: d.id,
      licenseNonce: d.license_nonce,
      userId: d.user_id,
      state: d.dunning_state as DunningState,
      gracePeriodDays: d.grace_period_days,
      maxRetryAttempts: d.max_retry_attempts,
      failedPaymentCount: 0,
      nextRetryAt: null,
      polarCustomerId: d.polar_customer_id,
      stripeCustomerId: d.stripe_customer_id,
      stateChangedAt: d.dunning_state_changed_at,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
      licenseTier: lic?.tier,
      licenseStatus: lic?.status,
      userEmail: usr?.email,
    };
  });
}

/**
 * Look up user_id for a given license nonce.
 */
export async function getLicenseUserId(
  licenseNonce: string,
  db: ReturnType<typeof createServerClient>
): Promise<string | null> {
  const { data } = await db
    .from('raas_api_keys')
    .select('user_id')
    .eq('license_nonce', licenseNonce)
    .single();

  return data ? (data as { user_id: string }).user_id : null;
}
