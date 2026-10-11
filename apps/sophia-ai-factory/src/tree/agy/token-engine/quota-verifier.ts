/**
 * Tenant Token Permission & Quota Scope Verifier
 * Layer: tree (domain-specific reusable)
 *
 * @module tree/agy/token-engine/quota-verifier
 */

/**
 * Validates whether a token's permissions satisfy the required permission scope.
 * Supports:
 * - Wildcard '*' or 'admin' grants all permissions
 * - Exact permission match ('read', 'write', 'video:generate')
 * - Namespace wildcard match ('video:*' matches 'video:generate')
 */
export function validateTokenPermissions(
  tokenPermissions: string[] | null | undefined,
  requiredPermission: string
): boolean {
  if (!requiredPermission) return true;
  if (!tokenPermissions || !Array.isArray(tokenPermissions) || tokenPermissions.length === 0) {
    return false;
  }

  const req = requiredPermission.trim().toLowerCase();

  for (const perm of tokenPermissions) {
    const p = perm.trim().toLowerCase();
    if (p === '*' || p === 'admin') return true;
    if (p === req) return true;

    // Namespace wildcard check (e.g. "agency:*" matches "agency:read")
    if (p.endsWith(':*')) {
      const prefix = p.slice(0, -1); // e.g. "agency:"
      if (req.startsWith(prefix)) return true;
    }
  }

  return false;
}
