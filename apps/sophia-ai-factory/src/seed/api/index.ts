/**
 * Centralized API utilities - error handling, response builders.
 *
 * @module seed/api
 */

export {
  buildErrorBody,
  errorResponse,
  handleThrownError,
} from './build-error-body';
export type { ApiErrorBody } from './build-error-body';
