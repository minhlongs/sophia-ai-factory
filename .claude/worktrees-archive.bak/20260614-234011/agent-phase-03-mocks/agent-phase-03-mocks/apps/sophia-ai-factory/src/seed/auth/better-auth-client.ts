/**
 * Better Auth client — frontend hooks and methods.
 */

import { createAuthClient } from 'better-auth/client';
import { magicLinkClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined'
    ? window.location.origin
    : (process.env.NEXT_PUBLIC_APP_URL || 'https://sophia.agencyos.network'),
  plugins: [
    magicLinkClient(),
  ],
});
