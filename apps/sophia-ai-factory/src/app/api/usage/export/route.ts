/**
 * Usage Export API
 *
 * GET /api/usage/export - Export usage data for billing/analytics
 * POST /api/usage/export - Export with JWT + API key auth, audit logging
 *
 * Query params (GET):
 *  - start: Unix timestamp (seconds) - start of date range
 *  - end: Unix timestamp (seconds) - end of date range
 *  - format: 'json' | 'csv' (default: 'json')
 *  - service: 'heygen' | 'elevenlabs' | 'openrouter' (optional filter)
 *
 * Body (POST):
 *  - billingPeriod: 'weekly' | 'monthly' | 'custom'
 *  - startDate: Unix timestamp (required for custom)
 *  - endDate: Unix timestamp (required for custom)
 *  - externalCustomerId: Polar customer ID filter
 *  - format: 'json' | 'csv'
 *  - service: Service filter
 *
 * Authentication (POST):
 *  - JWT (user session) + X-API-Key (mk_ API key)
 *  - Audit logging for all requests
 *  - Idempotency via request receipt
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { exportUsage, generateCsv } from '@/lib/usage-metering/export';
import { logger } from '@/lib/utils/logger-utility';
import { z } from 'zod';
import { validateApiKey } from '@/lib/security/api-key-validator';
import { logUsageWithReceipt } from '@/lib/audit/audit-logger';
import {
  generateCompleteExport,
  createDownloadableExport,
} from '@/lib/usage-export/export-service';
import type { BillingPeriod, ExportFormat } from '@/lib/usage-export/types';
import type { UserProfileRow, RaasLicenseRow } from '@/lib/supabase/types';

const exportQuerySchema = z.object({
  start: z.string().transform((val) => parseInt(val, 10)),
  end: z.string().transform((val) => parseInt(val, 10)),
  format: z.enum(['json', 'csv']).default('json'),
  service: z.enum(['heygen', 'elevenlabs', 'openrouter']).optional(),
  license_nonce: z.string().optional(),
});

/**
 * POST request schema - Billing reconciliation with Polar.sh support
 */
const postExportRequestSchema = z.object({
  billingPeriod: z.enum(['weekly', 'monthly', 'custom']),
  startDate: z.number().optional(),
  endDate: z.number().optional(),
  externalCustomerId: z.string().optional().nullable(),
  format: z.enum(['json', 'csv']).default('json'),
  service: z.string().optional().nullable(),
  licenseNonce: z.string().optional().nullable(),
  page: z.number().default(1),
  pageSize: z.number().default(100),
});

export async function GET(req: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query params
    const searchParams = req.nextUrl.searchParams;
    const parseResult = exportQuerySchema.safeParse({
      start: searchParams.get('start'),
      end: searchParams.get('end'),
      format: searchParams.get('format'),
      service: searchParams.get('service'),
      license_nonce: searchParams.get('license_nonce'),
    });

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid query params', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const { start, end, format, service, license_nonce } = parseResult.data;

    // Validate date range
    const now = Math.floor(Date.now() / 1000);
    if (start > end) {
      return NextResponse.json({ error: 'start must be before end' }, { status: 400 });
    }
    if (start > now || end > now) {
      return NextResponse.json({ error: 'Date range cannot be in the future' }, { status: 400 });
    }
    // Max 90-day range for performance
    const maxRange = 90 * 86400;
    if (end - start > maxRange) {
      return NextResponse.json({
        error: `Date range exceeds maximum of ${maxRange} seconds (${Math.floor(maxRange/86400)} days)`,
        suggestion: 'Split your request into multiple smaller date ranges'
      }, { status: 400 });
    }

    // Check admin status
    const { data: userData } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    const isAdmin = userData?.role === 'admin' || user.user_metadata?.role === 'admin';

    // Determine user ID and license nonce for query
    let userId = user.id;
    let queryLicenseNonce = license_nonce;

    // If license_nonce provided and user is admin, allow cross-user query
    if (license_nonce && !isAdmin) {
      // Verify ownership
      const { data: license } = await supabase
        .from('raas_licenses')
        .select('created_by')
        .eq('nonce', license_nonce)
        .single();

      if (!license || license.created_by !== user.id) {
        return NextResponse.json({ error: 'Forbidden - not your license' }, { status: 403 });
      }
    }

    // Export usage
    const usageData = await exportUsage({
      userId: isAdmin && license_nonce ? undefined : userId,
      licenseNonce: queryLicenseNonce,
      startTimestamp: start,
      endTimestamp: end,
      service,
      format,
    });

    logger.info('[Usage Export API] Exported usage', {
      userId,
      isAdmin,
      format,
      service,
      eventCount: usageData.events.length,
    });

    // Return response based on format
    if (format === 'csv') {
      const csv = generateCsv(usageData.events);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="usage-export-${userId}-${start}-${end}.csv"`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    return NextResponse.json({
      summary: usageData.summary,
      daily: usageData.daily,
      events: usageData.events,
      aggregated: usageData.aggregated,
      metadata: {
        userId: isAdmin ? 'all' : userId,
        licenseNonce: queryLicenseNonce || 'all',
        service: service || 'all',
        startTimestamp: start,
        endTimestamp: end,
        totalEvents: usageData.events.length,
        totalCredits: usageData.aggregated?.totalCredits || 0,
        totalRequests: usageData.aggregated?.totalRequests || 0,
        exportedAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    logger.error('[Usage Export API] Error exporting usage', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Failed to export usage' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/usage/export
 *
 * Export usage data with JWT + API key authentication, audit logging,
 * and Polar.sh billing period support.
 *
 * Authentication:
 * - JWT: User must be authenticated via Supabase Auth
 * - API Key: Valid mk_ API key with 'usage:export' permission
 *
 * Authorization:
 * - Users can export their own usage data
 * - Admins can export all usage data
 * - License owners can export data for their licenses
 */
export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    // Step 1: Authenticate user via JWT
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.warn('[Usage Export POST] Authentication failed', { requestId });
      return NextResponse.json({ error: 'Unauthorized - Invalid JWT' }, { status: 401 });
    }

    // Step 2: Validate API key from X-API-Key header
    const apiKey = req.headers.get('x-api-key');
    const apiValidation = await validateApiKey(apiKey);

    if (!apiValidation.valid) {
      logger.warn('[Usage Export POST] API key validation failed', {
        requestId,
        error: apiValidation.error
      });
      return NextResponse.json({
        error: 'Unauthorized - Invalid API key',
        errorCode: apiValidation.error
      }, { status: 401 });
    }

    // Step 3: Check API key permissions
    const hasPermission = apiValidation.apiKey?.permissions?.includes('usage:export') ?? false;
    if (!hasPermission) {
      logger.warn('[Usage Export POST] Insufficient permissions', {
        requestId,
        keyId: apiValidation.apiKey?.keyId
      });
      return NextResponse.json({
        error: 'Forbidden - API key lacks usage:export permission'
      }, { status: 403 });
    }

    // Step 4: Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parseResult = postExportRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({
        error: 'Invalid request body',
        details: parseResult.error.issues
      }, { status: 400 });
    }

    const {
      billingPeriod,
      startDate,
      endDate,
      externalCustomerId,
      format,
      service,
      licenseNonce,
      page,
      pageSize
    } = parseResult.data;

    // Step 5: Check admin status for authorization
    const { data: userData } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    const isAdmin = userData?.role === 'admin' || user.user_metadata?.role === 'admin';

    // Step 6: Authorization check
    // - Admins can export anything
    // - Regular users can only export their own data or their licenses
    if (!isAdmin) {
      if (externalCustomerId && licenseNonce) {
        // Verify license ownership
        const { data: license } = await supabase
          .from('raas_licenses')
          .select('created_by')
          .eq('nonce', licenseNonce)
          .single();

        if (!license || license.created_by !== user.id) {
          return NextResponse.json({
            error: 'Forbidden - Not your license'
          }, { status: 403 });
        }
      } else if (externalCustomerId) {
        // Check if external_customer_id belongs to user
        const { data: licenseCheck } = await supabase
          .from('raas_licenses')
          .select('created_by')
          .eq('polar_customer_id', externalCustomerId)
          .single();

        if (!licenseCheck || licenseCheck.created_by !== user.id) {
          return NextResponse.json({
            error: 'Forbidden - Not your customer ID'
          }, { status: 403 });
        }
      }
    }

    // Step 7: Generate export using service
    const exportResponse = await generateCompleteExport({
      billingPeriod: billingPeriod as BillingPeriod,
      startDate,
      endDate,
      externalCustomerId,
      format: format as ExportFormat,
      service,
      licenseNonce,
      page,
      pageSize,
    });

    // Step 8: Log to audit with receipt (compliance)
    const auditReceipt = await logUsageWithReceipt({
      nonce: licenseNonce || 'system-export',
      model_name: 'usage-export',
      token_count: exportResponse.records?.length || 0,
      endpoint: '/api/usage/export',
      userId: user.id,
      tier: userData?.role || 'user',
    });

    logger.info('[Usage Export POST] Export completed', {
      requestId,
      userId: user.id,
      isAdmin,
      billingPeriod,
      format,
      recordCount: exportResponse.records?.length || 0,
      auditReceiptId: auditReceipt?.receiptId,
    });

    // Step 9: Return response
    if (format === 'csv') {
      const downloadable = createDownloadableExport(exportResponse, 'csv');
      return new NextResponse(downloadable.content, {
        headers: {
          'Content-Type': downloadable.contentType,
          'Content-Disposition': `attachment; filename="${downloadable.filename}"`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Request-ID': requestId,
          'X-Audit-Receipt': auditReceipt ? Buffer.from(JSON.stringify(auditReceipt)).toString('base64url') : '',
        },
      });
    }

    // JSON response
    return NextResponse.json({
      ...exportResponse,
      metadata: {
        ...exportResponse.metadata,
        requestId,
        auditReceiptId: auditReceipt?.receiptId,
        exportedAt: new Date().toISOString(),
      },
    }, {
      headers: {
        'X-Request-ID': requestId,
        'X-Audit-Receipt': auditReceipt ? Buffer.from(JSON.stringify(auditReceipt)).toString('base64url') : '',
      },
    });

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('[Usage Export POST] Error', err, { requestId });

    return NextResponse.json(
      { error: 'Failed to export usage', requestId },
      { status: 500 }
    );
  }
}
