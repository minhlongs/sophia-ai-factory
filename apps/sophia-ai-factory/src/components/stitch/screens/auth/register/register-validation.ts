'use client';
// i18n-namespace: stitch.auth.register

/**
 * Registration validation and error mapping helpers
 */

import type { RegisterFormState } from './types';

type TranslateFn = (key: string) => string;

export function validateRegisterForm(
  formState: RegisterFormState,
  t: TranslateFn,
): string | null {
  const { email, password, confirmPassword, agreeTerms } = formState;
  const trimmedEmail = email.trim();

  if (!trimmedEmail || !trimmedEmail.includes('@')) {
    return t('errorEmailRequired') || 'Please enter a valid email address';
  }

  if (password !== confirmPassword) {
    return t('errorPasswordMismatch') || 'Passwords do not match';
  }

  if (password.length < 8) {
    return t('errorPasswordTooShort') || 'Password must be at least 8 characters';
  }

  if (!/[A-Z]/.test(password)) {
    return t('errorPasswordUppercase') || 'Password must include at least one uppercase letter';
  }
  if (!/[a-z]/.test(password)) {
    return t('errorPasswordLowercase') || 'Password must include at least one lowercase letter';
  }
  if (!/[0-9]/.test(password)) {
    return t('errorPasswordNumber') || 'Password must include at least one number';
  }

  if (!agreeTerms) {
    return (
      t('errorTermsRequired') ||
      'Please agree to the Terms of Service and Privacy Policy'
    );
  }

  return null;
}

export function mapRegisterAuthError(
  authError: { code?: string; message?: string; status?: number },
  t: TranslateFn,
): string {
  const code = authError.code?.toLowerCase() ?? '';
  const msg = authError.message?.toLowerCase() ?? '';
  const status = authError.status ?? 0;

  if (
    code === 'pilot_invite_required' ||
    code === 'pilot_access_revoked' ||
    msg.includes('invite-only') ||
    msg.includes('chỉ dành cho khách mời')
  ) {
    return (
      t('errorInviteRequired') ||
      'This private pilot is invite-only. Your email is not on the authorized pilot list.'
    );
  }

  if (
    code === 'user_already_exists' ||
    code === 'email_already_exists' ||
    msg.includes('already') ||
    msg.includes('exist') ||
    msg.includes('duplicate')
  ) {
    return t('errorEmailExists') || 'An account with this email already exists';
  }

  if (
    code === 'password_too_short' ||
    code === 'invalid_password' ||
    code === 'weak_password' ||
    msg.includes('password')
  ) {
    return (
      t('errorPasswordComplexity') ||
      'Password must be at least 8 characters with uppercase, lowercase, and a number'
    );
  }

  if (status === 429) {
    return t('errorRateLimited') || 'Too many attempts. Please wait a moment and try again.';
  }

  if (status === 503) {
    return (
      t('errorServiceUnavailable') ||
      'Registration is temporarily unavailable. Please try again later.'
    );
  }

  return t('errorGeneric') || 'Registration failed. Please try again.';
}
