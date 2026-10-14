export class D1NotAvailableError extends Error {
  constructor() {
    super('D1 database binding not available');
    this.name = 'D1NotAvailableError';
  }
}

export type User = {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  role?: string;
};

export type Session = {
  access_token: string;
  user: User;
  expires_at: number;
};

export type AuthError = {
  message: string;
  status?: number;
};

export type PostgrestError = {
  message: string;
  code?: string;
};
