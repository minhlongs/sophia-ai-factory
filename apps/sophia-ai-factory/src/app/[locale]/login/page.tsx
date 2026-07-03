import { Suspense } from 'react';
import { LoginPageContent } from './login-page-content';

/**
 * Login page route — Server Component that wraps client-side content
 * in a Suspense boundary so useSearchParams() works without errors.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse h-8 w-48 bg-muted rounded" />
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}
