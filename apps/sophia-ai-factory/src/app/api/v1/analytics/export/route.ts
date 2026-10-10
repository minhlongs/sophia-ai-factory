/**
 * API Route: Streaming Analytics & Executive BI Export
 *
 * Endpoint: /api/v1/analytics/export
 */

import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/seed/utils/logger-utility';
import {
  type ExportQueryParams,
  handleExportRequest,
} from './modules';

export const runtime = 'edge';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const params: ExportQueryParams = {
      format: searchParams.get('format'),
      start: searchParams.get('start'),
      end: searchParams.get('end'),
      category: searchParams.get('category'),
      orgId: searchParams.get('org_id') || searchParams.get('orgId'),
    };

    return await handleExportRequest(params);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[API:Export] Export failure', { error: message });
    return NextResponse.json(
      { error: 'EXPORT_FAILED', message: 'Internal server error during analytics export' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    let body: ExportQueryParams = {};
    try {
      body = (await request.json()) as ExportQueryParams;
    } catch {
      // Body is empty or not JSON, fallback to query parameters
    }

    const searchParams = request.nextUrl.searchParams;
    const params: ExportQueryParams = {
      format: body.format || searchParams.get('format'),
      start: body.start !== undefined ? String(body.start) : searchParams.get('start'),
      end: body.end !== undefined ? String(body.end) : searchParams.get('end'),
      category: body.category || searchParams.get('category'),
      orgId: body.orgId || searchParams.get('org_id') || searchParams.get('orgId'),
    };

    return await handleExportRequest(params);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[API:Export] Export failure', { error: message });
    return NextResponse.json(
      { error: 'EXPORT_FAILED', message: 'Internal server error during analytics export' },
      { status: 500 },
    );
  }
}
