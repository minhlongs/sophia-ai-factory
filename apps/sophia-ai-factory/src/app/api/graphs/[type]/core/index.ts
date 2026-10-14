import type { NextRequest, NextResponse } from 'next/server';
import { handleGraphRequest } from './route-handler';

export * from './types';
export * from './auth-gate';
export * from './ip-handlers';
export * from './content-handlers';
export * from './route-handler';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ type: string }> },
): Promise<NextResponse> {
  return handleGraphRequest(request, context);
}
