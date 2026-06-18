'use client';

export default function PricingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="max-w-md mx-auto text-center p-8 rounded-xl border border-border bg-card">
        <h2 className="text-2xl font-bold text-foreground mb-4">
          Pricing temporarily unavailable
        </h2>
        <p className="text-muted-foreground mb-6">
          We&apos;re experiencing technical difficulties with the pricing page.
          Please try again in a few minutes.
        </p>
        <button
          onClick={() => reset()}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
