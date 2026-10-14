import type { NextRequest, NextResponse } from 'next/server';
import { handleSloBurnRateCron } from './cron-handler';

export * from './types';
export * from './slo-configs';
export * from './metrics-evaluator';
export * from './alert-recorder';
export * from './cron-handler';

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handleSloBurnRateCron(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleSloBurnRateCron(request);
}
