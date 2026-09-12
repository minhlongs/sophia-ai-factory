'use client';

export default function ErrorBoundary({ error }: { error: Error }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-6 lg:px-8">
      <p className="text-sm text-destructive">
        {error.message ?? 'An unexpected error occurred'}
      </p>
    </div>
  );
}