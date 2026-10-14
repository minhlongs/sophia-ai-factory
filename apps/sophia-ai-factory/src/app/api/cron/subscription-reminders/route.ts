import { NextRequest, NextResponse } from 'next/server';
import { handleSubscriptionRemindersCron } from './core/index';

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handleSubscriptionRemindersCron(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleSubscriptionRemindersCron(request);
}
