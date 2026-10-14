import { logger } from '@/seed/utils/logger-utility';
import { GraphQLExecutionResult } from './types';
import { resolveAnalyticsQuery } from './query-resolver';

export async function executeGraphQLQuery(
  query: string,
  variables?: Record<string, unknown>,
  _operationName?: string,
): Promise<GraphQLExecutionResult> {
  try {
    const result = await resolveAnalyticsQuery(query, variables);
    return { data: result };
  } catch (error) {
    logger.error(
      '[GraphQL] Query execution error',
      error instanceof Error ? error : new Error(String(error)),
    );
    return {
      errors: [
        {
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      ],
    };
  }
}
