/**
 * GraphQL API Handler for Analytics
 *
 * POST /api/graphql/analytics
 *
 * Handles GraphQL queries for analytics data
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/seed/utils/logger-utility';
import { resolvers } from '@/land/analytics/graphql-resolvers';
import { getCurrentUser } from '@/seed/auth/better-auth-session';

interface GraphQLExecutionResult {
  data?: unknown;
  errors?: Array<{ message: string }>;
}

interface GraphQLQueryRequest {
  query?: string;
  variables?: Record<string, unknown>;
  operationName?: string;
}

/**
 * Execute GraphQL query
 */
async function executeQuery(
  query: string,
  variables?: Record<string, unknown>,
  operationName?: string // eslint-disable-line @typescript-eslint/no-unused-vars
): Promise<unknown> {
  try {
    // Parse the query
    // For a simple implementation, we'll manually resolve
    // In production, use @graphql-tools/schema with makeExecutableSchema

    // Execute using our resolvers
    const result = await resolveQuery(query, variables);

    return { data: result };
  } catch (error) {
    logger.error('[GraphQL] Query execution error', error instanceof Error ? error : new Error(String(error)));
    return {
      errors: [
        {
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      ],
    };
  }
}

/**
 * Manually resolve GraphQL query against resolvers
 * This is a simplified implementation
 */
async function resolveQuery(
  queryString: string,
  variables?: Record<string, unknown> // eslint-disable-line @typescript-eslint/no-unused-vars
): Promise<unknown> {
  // Simple regex-based extraction for analytics query
  // This is a basic implementation - for production use graphql-tools

  const analyticsResult: Record<string, unknown> = {};

  // Check for usage query
  const usageMatch = queryString.match(/usage\s*\(\s*start:\s*(\d+)\s*,\s*end:\s*(\d+)(?:\s*,\s*granularity:\s*(\w+))?(?:\s*,\s*licenseNonce:\s*"([^"]+)")?/);
  if (usageMatch) {
    const args = {
      start: parseInt(usageMatch[1], 10),
      end: parseInt(usageMatch[2], 10),
      granularity: usageMatch[3] as 'hour' | 'day' || 'hour',
      licenseNonce: usageMatch[4],
    };
    if (resolvers.Analytics?.usage) {
      analyticsResult.usage = await resolvers.Analytics.usage({}, args);
    }
  }

  // Check for revenue query
  const revenueMatch = queryString.match(/revenue\s*\(\s*period:\s*"([^"]+)"/);
  if (revenueMatch) {
    const args = { period: revenueMatch[1] as 'current_month' | 'last_month' | 'last_7_days' | 'last_30_days' };
    if (resolvers.Analytics?.revenue) {
      analyticsResult.revenue = await resolvers.Analytics.revenue({}, args);
    }
  }

  // Check for licenses query
  const licensesMatch = queryString.match(/licenses\s*\(\s*status:\s*"([^"]+)"/);
  if (licensesMatch) {
    const args = { status: licensesMatch[1] as 'active' | 'expired' | 'revoked' | 'all' };
    if (resolvers.Analytics?.licenses) {
      analyticsResult.licenses = await resolvers.Analytics.licenses({}, args);
    }
  }

  // Check for roi query
  const roiMatch = queryString.match(/roi\s*\(\s*licenseNonce:\s*"([^"]+)"/);
  if (roiMatch) {
    const args = { licenseNonce: roiMatch[1] };
    if (resolvers.Analytics?.roi) {
      analyticsResult.roi = await resolvers.Analytics.roi({}, args);
    }
  }

  return analyticsResult;
}

/**
 * POST handler for GraphQL endpoint
 */
export async function POST(request: NextRequest) {
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
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    logger.info('[GraphQL] Processing query', {
      query: query.substring(0, 100),
      variables,
      operationName,
    });

    // Execute the query
    const result = (await executeQuery(query, variables, operationName)) as GraphQLExecutionResult;

    logger.info('[GraphQL] Query executed', {
      hasData: !!result.data,
      hasErrors: !!result.errors,
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error('[GraphQL] Critical error', error instanceof Error ? error : new Error(String(error)));

    return NextResponse.json(
      {
        errors: [
          {
            message: error instanceof Error ? error.message : 'Internal server error',
          },
        ],
      },
      { status: 500 }
    );
  }
}

/**
 * GET handler for GraphQL endpoint (schema introspection hint)
 */
export async function GET(request: NextRequest) { // eslint-disable-line @typescript-eslint/no-unused-vars
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
