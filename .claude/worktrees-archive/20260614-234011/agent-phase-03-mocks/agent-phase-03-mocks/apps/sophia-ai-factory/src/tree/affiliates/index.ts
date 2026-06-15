/**
 * Affiliates layer — tree wrapper for cross-layer access.
 *
 * Tree code imports from '@/tree/affiliates' instead of '@/land/affiliates'.
 * Re-exports from land/affiliates (canonical implementation).
 */
export { getTopPrograms, getProgramById } from '@/land/affiliates';
export { generateShortCode } from '@/land/affiliate-shortlink/short-code-generator';
