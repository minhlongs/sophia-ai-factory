import type { NextRequest, NextResponse } from 'next/server';
import { handleInstagramOAuthCallback } from './route-handler';

export * from './types';
export * from './state-verifier';
export * from './token-client';
export * from './account-binder';
export * from './route-handler';

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handleInstagramOAuthCallback(request);
}
