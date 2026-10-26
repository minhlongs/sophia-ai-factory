/**
 * Better Auth client — Auth 2027 frontend hooks and methods.
 * Supports Passkeys (WebAuthn), 6-digit Email OTP, Two-Factor (TOTP),
 * Magic Link, and Email/Password fallback.
 */

import { createAuthClient } from 'better-auth/client';
import {
  emailOTPClient,
  twoFactorClient,
  magicLinkClient,
} from 'better-auth/client/plugins';
import { passkeyClient } from '@better-auth/passkey/client';

export const authClient = createAuthClient({
  baseURL:
    typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || 'https://sophia.agencyos.network',
  plugins: [
    passkeyClient(),
    emailOTPClient(),
    twoFactorClient(),
    magicLinkClient(),
  ],
});
