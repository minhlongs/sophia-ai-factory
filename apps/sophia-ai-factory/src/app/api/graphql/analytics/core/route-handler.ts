import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/seed/utils/logger-utility';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { GraphQLQueryRequest, GraphQLExecutionResult } from './types';
import { executeGraphQLQuery } from './query-executor';

export async function handleAnalyticsGraphQLPost(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ errors: [{ message: 'Unauthorized' }] }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return NextResponse.json({ errors: [{ message: 'Forbidden — admin only' }] }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as GraphQLQueryRequest;
    const { query, variables, operationName } = body;

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    logger.info('[GraphQL] Processing query', {
      query: query.substring(0, 100),
      variables,
      operationName,
    });

    const result = (await executeGraphQLQuery(query, variables, operationName)) as GraphQLExecutionResult;

    logger.info('[GraphQL] Query executed', {
      hasData: !!result.data,
      hasErrors: !!result.errors,
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error(
      '[GraphQL] Critical error',
      error instanceof Error ? error : new Error(String(error)),
    );

    return NextResponse.json(
      {
        errors: [
          {
            message: error instanceof Error ? error.message : 'Internal server error',
          },
        ],
      },
      { status: 500 },
    );
  }
}

export async function handleAnalyticsGraphQLGet(_request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 });
  }

  return NextResponse.json({
    message: 'Analytics GraphQL API',
    endpoint: 'POST /api/graphql/analytics',
    schema: {
      type: 'Analytics',
      queries: ['usage', 'revenue', 'licenses', 'roi'],
    },
    example: {
      query: `
        query {
          analytics {
            usage(start: 1709251200, end: 1709337600, granularity: day) {
              summary {
                totalRequests
                totalCredits
              }
              timeSeries {
                timestamp
                requests
                credits
              }
            }
            revenue(period: "last_30_days") {
              totalRevenue
              byTier {
                tier
                revenue
              }
            }
          }
        }
      `,
    },
  });
}
