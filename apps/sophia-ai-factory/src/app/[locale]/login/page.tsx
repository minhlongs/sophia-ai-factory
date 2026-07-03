import { Suspense } from 'react';
import { LoginPage as StitchLoginPage } from '@/components/stitch/screens/login/login-page';
import RegisterPage from '@/components/stitch/screens/auth/register-page';

type SearchParams = Promise<{ tab?: string; next?: string; redirect?: string }>;

type Props = {
  searchParams: SearchParams;
};

/**
 * Login page route — Server Component that handles tab routing
 * and renders the Stitch login screen directly.
 *
 * searchParams is handled at the route level (server-side) so the
 * Stitch login page component does not need useSearchParams().
 */
export default async function LoginPage(props: Props) {
  const params = await props.searchParams;
  const tab = params?.tab;
  const redirectTo = params?.next || params?.redirect || undefined;

  // Tab routing: ?tab=signup renders the register page
  if (tab === 'signup') {
    return (
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="animate-pulse h-8 w-48 bg-muted rounded" />
        </div>
      }>
        <RegisterPage />
      </Suspense>
    );
  }

  // Default: render the Stitch login page (server component — no Suspense needed)
  return <StitchLoginPage redirectTo={redirectTo} />;
}
