/**
 * Financial close action types & common interfaces
 * @module land/finance/close/types
 */

export interface FinancialCloseActionError {
  code: string;
  message: string;
}

export interface AuthContext {
  userId: string;
  userEmail: string;
  isAdmin: boolean;
}

export function normalizeErrorArg(err: unknown): Error | Record<string, unknown> {
  if (err instanceof Error) return err;
  return { error: String(err) };
}
