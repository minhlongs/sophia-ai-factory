import { logger } from '@/seed/utils/logger-utility';
import { AssemblyAIClientError } from './types';

export async function handleErrorResponse(response: Response, operation: string): Promise<never> {
  const body = await response.text().catch((err) => {
    logger.warn('Failed to read response body', { error: String(err), context: 'handleErrorResponse' });
    return '';
  });
  const code = response.status;

  if (code === 429) {
    throw new AssemblyAIClientError(429, `[AssemblyAIClient.${operation}] Rate limit exceeded: ${body}`);
  }
  if (code === 402) {
    throw new AssemblyAIClientError(402, `[AssemblyAIClient.${operation}] Payment required — check AssemblyAI credits: ${body}`);
  }
  if (code === 400) {
    throw new AssemblyAIClientError(400, `[AssemblyAIClient.${operation}] Invalid request parameters: ${body}`);
  }
  if (code === 404) {
    throw new AssemblyAIClientError(404, `[AssemblyAIClient.${operation}] Transcript not found: ${body}`);
  }
  throw new AssemblyAIClientError(code, `[AssemblyAIClient.${operation}] API error ${code}: ${body}`);
}
