/**
 * License Access Verification Helpers for Analytics
 *
 * @module forest/analytics/rbac-license
 */

/**
 * Verify user can access specific license data
 */
export async function verifyLicenseAccess(
  userId: string,
  licenseNonce: string,
  isAdmin: boolean
): Promise<{ allowed: boolean; error?: string }> {
  // Admins can access any license
  if (isAdmin) {
    return { allowed: true };
  }

  // Non-admin users can only access their own licenses
  const { createServerClient } = await import('@/seed/db/client');
  const db = createServerClient();

  const { data: license } = await db
    .from<{ created_by: string | null }>('raas_licenses')
    .select('created_by')
    .eq('nonce', licenseNonce)
    .single();

  if (!license) {
    return { allowed: false, error: 'License not found' };
  }

  if (license.created_by !== userId) {
    return {
      allowed: false,
      error: 'Access denied - you can only view your own license data',
    };
  }

  return { allowed: true };
}

/**
 * Get user's own active license nonce
 */
export async function getUserLicenseNonce(userId: string): Promise<string | null> {
  const { createServerClient } = await import('@/seed/db/client');
  const db = createServerClient();

  const { data: license } = await db
    .from<{ nonce: string | null }>('raas_licenses')
    .select('nonce')
    .eq('created_by', userId)
    .eq('is_revoked', false)
    .order('created_at', { ascending: false })
    .single();

  return license?.nonce || null;
}
