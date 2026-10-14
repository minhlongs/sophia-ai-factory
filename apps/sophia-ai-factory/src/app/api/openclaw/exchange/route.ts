import { NextRequest, NextResponse } from 'next/server';
import { handleOpenClawExchange } from './core/index';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleOpenClawExchange(request);
}
