/**
 * CDN Actions Types & Error interfaces
 */

export interface ActionError {
  code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION_ERROR' | 'DB_ERROR';
  message: string;
}
