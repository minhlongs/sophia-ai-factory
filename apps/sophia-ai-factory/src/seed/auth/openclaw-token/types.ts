export interface OpenclawTokenParts {
  userId: string;
  expiresAt: number;
  jti: string;
  signature: string;
  payload: string; // "userId.expiresAt.jti"
}

export interface VerifiedOpenclawToken {
  userId: string;
  expiresAt: number;
  jti: string;
}
