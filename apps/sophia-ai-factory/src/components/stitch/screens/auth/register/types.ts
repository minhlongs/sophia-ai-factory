/**
 * Types for Register Page
 *
 * Layer: components/stitch/screens/auth/register
 */

export interface RegisterFormState {
  companyName: string;
  email: string;
  password: string;
  confirmPassword: string;
  agreeTerms: boolean;
}

export type RegisterStep = 'form' | 'success';
