---
title: "Phase 02: Usage Export API Implementation"
description: Implement POST /api/usage/export endpoint with JWT + API key authentication
status: pending
priority: P1
effort: 2h
branch: main
tags: [api, endpoint, authentication, export]
created: 2026-03-08
---

# Phase 02: Usage Export API Implementation

## Overview

Implement the POST /api/usage/export endpoint with dual authentication (JWT + mk_ API key), request validation, and support for multiple export formats.

## Success Criteria

- [ ] POST /api/usage/export endpoint accepts valid requests
- [ ] JWT authentication validates logged-in user
- [ ] API key (mk_) validation with permission checks
- [ ] Request validation using Zod schemas from Phase 01
- [ ] Returns JSON or CSV based on format parameter
- [ ] Audit logs all export requests

## Files to Create

1. `src/app/api/usage/export/export-auth.ts` - Authentication helpers
2. `src/app/api/usage/export/middleware.ts` - Request validation middleware

## Files to Modify

1. `src/app/api/usage/export/route.ts` - Extend existing GET to add POST handler

## Implementation Steps

### Step 1: Create Export Auth Helpers (`src/app/api/usage/export/export-auth.ts`)

```typescript
/**
 * Usage Export API - Authentication & Authorization
 *
 * Handles JWT + API key dual authentication for export requests
 */

import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateApiKey } from '@/lib/security/api-key-validator';
import { logger } from '@/lib/utils/logger-utility';

/**
 * Authentication result for export requests
 */
export interface ExportAuthResult {
  authenticated: boolean;
  userId: string;
  isAdmin: boolean;
  apiKeyPermissions?: string[];
  error?: {
    code: 'unauthorized' | 'forbidden' | 'invalid-api-key';
    message: string;
  };
}

/**
 * Authenticate export request with JWT + API key
 *
 * Authentication flow:
 * 1. Validate JWT from Supabase Auth (required)
 * 2. Validate API key from X-API-Key header (required for billing_system audience)
 * 3. Check admin status for cross-user exports
 * 4. Verify API key permissions match requested action
 *
 * @param request - Next.js request object
 * @param audience - Export audience level
 */
export async function authenticateExportRequest(
  request: NextRequest,
  audience: 'self' | 'admin' | 'billing_system'
): Promise<ExportAuthResult> {
  try {
    // Step 1: Validate JWT (Supabase Auth)
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.warn('[Export Auth] JWT authentication failed', {
        error: authError?.message,
      });
      return {
        authenticated: false,
        userId: '',
        isAdmin: false,
        error: {
          code: 'unauthorized',
          message: 'Authentication required. Please log in.',
        },
      };
    }

    // Step 2: Check admin status
    const { data: userData } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single() as any;

    const isAdmin = userData?.role === 'admin' ||
                    (user.user_metadata as any)?.role === 'admin';

    // Step 3: API key validation for billing_system audience
    const apiKey = request.headers.get('x-api-key');
    let apiKeyPermissions: string[] | undefined;

    if (audience === 'billing_system') {
      if (!apiKey) {
        return {
          authenticated: false,
          userId: user.id,
          isAdmin,
          error: {
            code: 'unauthorized',
            message: 'API key required for billing system exports. Include X-API-Key header.',
          },
        };
      }

      const validation = await validateApiKey(apiKey);
      if (!validation.valid || !validation.apiKey) {
        return {
          authenticated: false,
          userId: user.id,
          isAdmin,
          error: {
            code: 'invalid-api-key',
            message: `Invalid API key: ${validation.error || 'Unknown error'}`,
          },
        };
      }

      apiKeyPermissions = validation.apiKey.permissions;

      // Check if API key has export permission
      const hasExportPermission = apiKeyPermissions.some(p =>
        p === 'usage:export' || p === 'usage:read' || p === '*'
      );

      if (!hasExportPermission) {
        return {
          authenticated: false,
          userId: user.id,
          isAdmin,
          error: {
            code: 'forbidden',
            message: 'API key lacks usage:export permission',
          },
        };
      }
    }

    logger.info('[Export Auth] Authentication successful', {
      userId: user.id,
      isAdmin,
      audience,
      hasApiKey: !!apiKey,
    });

    return {
      authenticated: true,
      userId: user.id,
      isAdmin,
      apiKeyPermissions,
    };
  } catch (error) {
    logger.error('[Export Auth] Authentication error', error as Error);
    return {
      authenticated: false,
      userId: '',
      isAdmin: false,
      error: {
        code: 'unauthorized',
        message: 'Authentication failed',
      },
    };
  }
}

/**
 * Check if user can access requested license/customer data
 */
export async function checkExportAuthorization(
  userId: string,
  isAdmin: boolean,
  licenseNonce?: string,
  customerId?: string
): Promise<{ authorized: boolean; error?: string }> {
  // Admins can access everything
  if (isAdmin) {
    return { authorized: true };
  }

  // Self-export: user can only access their own data
  if (licenseNonce) {
    const supabase = createAdminClient();
    const { data: license } = await supabase
      .from('raas_licenses')
      .select('created_by')
      .eq('nonce', licenseNonce)
      .single() as any;

    if (!license || license.created_by !== userId) {
      return {
        authorized: false,
        error: 'Forbidden - not your license',
      };
    }
  }

  if (customerId) {
    // Verify customer belongs to user
    const supabase = createAdminClient();
    const { data: licenses } = await supabase
      .from('raas_licenses')
      .select('created_by')
      .eq('polar_customer_id', customerId)
      .single() as any;

    if (!licenses || licenses.created_by !== userId) {
      return {
        authorized: false,
        error: 'Forbidden - not your customer data',
      };
    }
  }

  return { authorized: true };
}
```

### Step 2: Create Middleware (`src/app/api/usage/export/middleware.ts`)

```typescript
/**
 * Usage Export API - Request Validation Middleware
 */

import { NextRequest, NextResponse } from 'next/server';
import { exportRequestSchema, ExportRequest } from '@/lib/usage-metering/export-validator';
import { authenticateExportRequest, checkExportAuthorization } from './export-auth';
import { logger } from '@/lib/utils/logger-utility';

/**
 * Validate and authorize export request
 *
 * @param request - Next.js request
 * @returns Validated request data or error response
 */
export async function validateExportRequest(
  request: NextRequest
): Promise<{
  success: true;
  data: ExportRequest;
  userId: string;
  isAdmin: boolean;
} | {
  success: false;
  response: NextResponse;
}> {
  try {
    // Parse JSON body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return {
        success: false,
        response: NextResponse.json(
          { error: 'Invalid JSON body' },
          { status: 400 }
        ),
      };
    }

    // Validate with Zod schema
    const parseResult = exportRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return {
        success: false,
        response: NextResponse.json(
          {
            error: 'Invalid request body',
            details: parseResult.error.flatten(),
          },
          { status: 400 }
        ),
      };
    }

    const requestData = parseResult.data;

    // Authenticate
    const authResult = await authenticateExportRequest(
      request,
      requestData.audience
    );

    if (!authResult.authenticated) {
      return {
        success: false,
        response: NextResponse.json(
          { error: authResult.error?.message },
          { status: authResult.error?.code === 'forbidden' ? 403 : 401 }
        ),
      };
    }

    // Check authorization for specific license/customer
    const authCheck = await checkExportAuthorization(
      authResult.userId,
      authResult.isAdmin,
      requestData.licenseNonce,
      requestData.customerId
    );

    if (!authCheck.authorized) {
      return {
        success: false,
        response: NextResponse.json(
          { error: authCheck.error },
          { status: 403 }
        ),
      };
    }

    // Resolve timestamps from billing period if needed
    let { startTimestamp, endTimestamp } = requestData;
    if (!startTimestamp || !endTimestamp) {
      // Use billing period
      startTimestamp = requestData.billingPeriodStart!;
      endTimestamp = requestData.billingPeriodEnd!;
    }

    const validatedRequest: ExportRequest = {
      ...requestData,
      startTimestamp,
      endTimestamp,
      userId: authResult.userId,
    };

    return {
      success: true,
      data: validatedRequest,
      userId: authResult.userId,
      isAdmin: authResult.isAdmin,
    };
  } catch (error) {
    logger.error('[Export Middleware] Validation error', error as Error);
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Internal server error during validation' },
        { status: 500 }
      ),
    };
  }
}
```

### Step 3: Update Route Handler (`src/app/api/usage/export/route.ts`)

Replace the existing GET handler and add POST:

```typescript
/**
 * Usage Export API
 *
 * POST /api/usage/export - Export usage data for billing reconciliation
 * GET /api/usage/export - Legacy support (redirects to POST logic)
 *
 * Authentication:
 *  - JWT (Supabase Auth) - required for all requests
 *  - API Key (mk_) - required for billing_system audience
 *
 * Request body (POST):
 *  - userId: string (auto-filled from auth)
 *  - licenseNonce?: string
 *  - startTimestamp: number
 *  - endTimestamp: number
 *  - format: 'json' | 'csv'
 *  - audience: 'self' | 'admin' | 'billing_system'
 *  - service?: 'heygen' | 'elevenlabs' | 'openrouter'
 *  - customerId?: string
 *  - billingPeriodType?: 'weekly' | 'monthly'
 *  - billingPeriodStart?: number
 *  - billingPeriodEnd?: number
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateExportRequest } from './middleware';
import { exportUsageData } from '@/lib/usage-metering/export-service';
import { logExportAudit } from '@/lib/audit/export-audit-logger';
import { generateCsv } from '@/lib/usage-metering/export';
import { logger } from '@/lib/utils/logger-utility';

/**
 * POST: Export usage data
 */
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    // Validate request
    const validationResult = await validateExportRequest(request);

    if (!validationResult.success) {
      return validationResult.response;
    }

    const { data, userId, isAdmin } = validationResult;

    logger.info('[Usage Export API] Export request', {
      requestId,
      userId,
      format: data.format,
      dateRange: `${data.startTimestamp} - ${data.endTimestamp}`,
    });

    // Export data
    const exportResult = await exportUsageData({
      userId: isAdmin ? undefined : userId,
      licenseNonce: data.licenseNonce,
      customerId: data.customerId,
      startTimestamp: data.startTimestamp,
      endTimestamp: data.endTimestamp,
      service: data.service,
      includeRawPayload: data.includeRawPayload,
      includeAggregated: data.includeAggregated,
    });

    // Log audit (non-blocking)
    logExportAudit({
      exportId: exportResult.exportId,
      userId,
      licenseNonce: data.licenseNonce,
      format: data.format,
      rowCount: exportResult.rowCount,
      dateRange: {
        start: data.startTimestamp,
        end: data.endTimestamp,
      },
      ipAddress: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
    }).catch(err => logger.error('[Export API] Audit log failed', err));

    // Return response based on format
    if (data.format === 'csv') {
      const csv = generateCsv(exportResult.rows);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="usage-export-${exportResult.exportId}.csv"`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Export-ID': exportResult.exportId,
          'X-Export-Rows': String(exportResult.rowCount),
        },
      });
    }

    return NextResponse.json({
      success: true,
      exportId: exportResult.exportId,
      format: data.format,
      rowCount: exportResult.rowCount,
      dateRange: {
        start: data.startTimestamp,
        end: data.endTimestamp,
      },
      summary: exportResult.summary,
      data: exportResult.rows,
      aggregated: exportResult.aggregated,
      metadata: {
        generatedAt: new Date().toISOString(),
        requestId,
      },
    });

  } catch (error) {
    logger.error('[Usage Export API] Critical error', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to export usage data',
        requestId,
      },
      { status: 500 }
    );
  }
}

/**
 * GET: Legacy support - redirect to POST logic
 */
export async function GET(request: NextRequest) {
  // Convert query params to body and forward to POST logic
  const searchParams = request.nextUrl.searchParams;

  const body = {
    format: (searchParams.get('format') as 'json' | 'csv') || 'json',
    audience: 'self' as const,
    startTimestamp: parseInt(searchParams.get('start') || '0', 10),
    endTimestamp: parseInt(searchParams.get('end') || '0', 10),
    service: searchParams.get('service') as 'heygen' | 'elevenlabs' | 'openrouter' | undefined,
    licenseNonce: searchParams.get('license_nonce') || undefined,
    includeRawPayload: searchParams.get('include_raw') === 'true',
    includeAggregated: searchParams.get('include_aggregated') !== 'false',
  };

  // Create new request with body
  const modifiedRequest = new NextRequest(request.nextUrl, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify(body),
  });

  return POST(modifiedRequest);
}
```

## Todo Checklist

- [ ] Create `src/app/api/usage/export/export-auth.ts`
- [ ] Create `src/app/api/usage/export/middleware.ts`
- [ ] Update `src/app/api/usage/export/route.ts`
- [ ] Test authentication flow
- [ ] Test API key validation
- [ ] Test request validation
- [ ] Test CSV output
- [ ] Test JSON output

## Related Code Files

- `src/lib/security/api-key-validator.ts` - API key validation
- `src/lib/audit/audit-logger.ts` - Audit logging pattern
- `src/lib/usage-metering/export-validator.ts` - Zod schemas
- `src/lib/usage-metering/export-service.ts` - Export business logic

## Dependencies

- Phase 01: Types and validation schemas must be completed first
- Existing Supabase Auth setup
- Existing API key system

## Unresolved Questions

1. Should we rate limit export requests differently based on audience?
2. Should large exports (>10K rows) be handled asynchronously with webhook notification?
