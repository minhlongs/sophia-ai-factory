import { NextRequest } from 'next/server';
import { sanitizeInput } from './tenant-isolation-agency-extractor';

/** Determine resource type and ID from request pathname. */
export function extractResourceInfo(
  pathname: string,
  method: string,
  _request: NextRequest
): { resourceType: string; resourceId: string | null } {
  const normalizedPath = pathname.replace(/^\/(en|vi)\//, '/');

  if (normalizedPath.startsWith('/api/v1/usage/')) {
    const parts = normalizedPath.split('/');
    if (parts.length >= 5) {
      const resourceId = sanitizeInput(parts[4]);
      return { resourceType: 'usage_event', resourceId: resourceId ?? null };
    }
  } else if (normalizedPath.startsWith('/api/admin/licenses/')) {
    const parts = normalizedPath.split('/');
    if (parts.length >= 5) {
      const resourceId = sanitizeInput(parts[4]);
      return { resourceType: 'license', resourceId: resourceId ?? null };
    }
  } else if (normalizedPath.startsWith('/api/admin/usage/reconciliation/')) {
    const parts = normalizedPath.split('/');
    if (parts.length >= 6) {
      const resourceId = sanitizeInput(parts[5]);
      return { resourceType: 'reconciliation_job', resourceId: resourceId ?? null };
    }
  } else if (normalizedPath.startsWith('/api/user/audit-logs/')) {
    const parts = normalizedPath.split('/');
    if (parts.length >= 5) {
      const resourceId = sanitizeInput(parts[4]);
      return { resourceType: 'audit_log', resourceId: resourceId ?? null };
    }
  } else if (normalizedPath.startsWith('/api/usage/')) {
    const parts = normalizedPath.split('/');
    if (parts.length >= 4) {
      const resourceId = sanitizeInput(parts[3]);
      return { resourceType: 'usage_summary', resourceId: resourceId ?? null };
    }
  }

  if (normalizedPath.startsWith('/api/v1/usage') && method === 'GET') {
    return { resourceType: 'usage_event', resourceId: null };
  }

  if (normalizedPath.startsWith('/api/admin/licenses') && method === 'GET') {
    return { resourceType: 'license', resourceId: null };
  }

  return { resourceType: 'unknown', resourceId: null };
}
