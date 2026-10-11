import { addMemory } from './memory-mutations';

/**
 * Shorthand: add an episodic memory entry sourced from a SOP execution.
 * Returns the generated memory ID.
 * Throws on D1 error.
 */
export async function addEpisodicFromExecution(
  userId: string,
  executionId: string,
  contentJson: string,
): Promise<string> {
  return addMemory({
    userId,
    memoryType: 'episodic',
    category: 'execution',
    contentJson,
    sourceExecutionId: executionId,
  });
}
