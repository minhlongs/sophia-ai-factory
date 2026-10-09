/**
 * Action Error types and contracts for Enterprise GPU Reservations
 *
 * @module land/enterprise/gpu-reservations/types
 */

export interface ActionError {
  code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION_ERROR' | 'DB_ERROR';
  message: string;
}
