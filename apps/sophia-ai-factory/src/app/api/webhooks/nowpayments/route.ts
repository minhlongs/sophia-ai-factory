import { NextRequest, NextResponse } from 'next/server';
import { handleNowPaymentsGet, handleNowPaymentsPost } from './service';

export async function GET(): Promise<NextResponse> {
  return handleNowPaymentsGet();
}

/** Enforces request.headers.get('x-nowpayments-sig'), parseIpnWebhook(rawPayload, signature), status: 400 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleNowPaymentsPost(request);
}
