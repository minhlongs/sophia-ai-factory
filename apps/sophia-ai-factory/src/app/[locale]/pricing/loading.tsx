import { Skeleton } from '@/seed/components/ui/skeleton';

export default function PricingLoading() {
  return (
    <div className="min-h-screen bg-background pt-16">
      <div className="mx-auto max-w-3xl px-6 py-8 space-y-4">
        <Skeleton className="h-10 w-3/4 mx-auto" />
        <Skeleton className="h-6 w-1/2 mx-auto" />
        <div className="grid gap-8 md:grid-cols-3 mt-12">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-80 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
