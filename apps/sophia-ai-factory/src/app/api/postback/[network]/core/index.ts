import type { NextRequest, NextResponse } from 'next/server';
import { handlePostbackRoute } from './route-handler';

export * from './types';
export * from './signature-verifier';
export * from './route-handler';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ network: string }> },
): Promise<NextResponse> {
  return handlePostbackRoute(request, context);
}
