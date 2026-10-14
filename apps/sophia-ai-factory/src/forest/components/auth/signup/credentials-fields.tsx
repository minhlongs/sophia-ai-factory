// i18n-namespace: auth.signup
'use client';

import { Mail, Lock, User } from 'lucide-react';
import type { CredentialsFieldsProps } from './types';

export function CredentialsFields({
  t,
  name,
  email,
  password,
  confirm,
  error,
  onNameChange,
  onEmailChange,
  onPasswordChange,
  onConfirmChange,
}: CredentialsFieldsProps) {
  const isEmailError = error === t.error_email_exists;
  const isPasswordError = error === t.error_password_too_short || error === t.error_password_mismatch;
  const isConfirmError = error === t.error_password_mismatch;

  return (
    <>
      <div className="space-y-1">
        <label htmlFor="signup-name" className="text-sm font-medium text-foreground">
          {t.name_label}
        </label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            id="signup-name"
            type="text"
            required
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder={t.name_placeholder}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/50"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="signup-email" className="text-sm font-medium text-foreground">
          {t.email_label}
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            id="signup-email"
            type="email"
            required
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder={t.email_placeholder}
            aria-invalid={isEmailError ? true : undefined}
            aria-describedby={isEmailError ? 'signup-error' : undefined}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/50"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="signup-password" className="text-sm font-medium text-foreground">
          {t.password_label}
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            id="signup-password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder={t.password_placeholder}
            aria-invalid={isPasswordError ? true : undefined}
            aria-describedby={isPasswordError ? 'signup-error' : undefined}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/50"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="signup-confirm" className="text-sm font-medium text-foreground">
          {t.confirm_label}
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            id="signup-confirm"
            type="password"
            required
            value={confirm}
            onChange={(e) => onConfirmChange(e.target.value)}
            placeholder={t.confirm_placeholder}
            aria-invalid={isConfirmError ? true : undefined}
            aria-describedby={isConfirmError ? 'signup-error' : undefined}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/50"
          />
        </div>
      </div>
    </>
  );
}
