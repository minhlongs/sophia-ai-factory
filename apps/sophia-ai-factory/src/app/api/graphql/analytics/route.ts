import { NextRequest, NextResponse } from 'next/server';
import {
  handleAnalyticsGraphQLPost,
  handleAnalyticsGraphQLGet,
} from './core/index';

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleAnalyticsGraphQLPost(request);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handleAnalyticsGraphQLGet(request);
}
