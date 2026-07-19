import { Skeleton } from "@/seed/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Skeleton shimmer className="h-10 w-10 rounded-lg" />
        <div className="space-y-2">
          <Skeleton shimmer className="h-6 w-48" />
          <Skeleton shimmer className="h-4 w-64" />
        </div>
      </div>

      {/* Challenge cards grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-4">
            {/* Title row */}
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-2">
                <Skeleton shimmer className="h-4 w-32" />
                <Skeleton shimmer className="h-3 w-48" />
              </div>
              <Skeleton shimmer className="h-5 w-16 rounded-full" />
            </div>

            {/* Progress bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <Skeleton shimmer className="h-3 w-12" />
                <Skeleton shimmer className="h-3 w-20" />
              </div>
              <Skeleton shimmer className="h-2 w-full rounded-full" />
              <Skeleton shimmer className="h-3 w-8 ml-auto" />
            </div>

            {/* Reward + days */}
            <div className="flex items-center justify-between text-xs">
              <Skeleton shimmer className="h-3 w-32" />
              <Skeleton shimmer className="h-3 w-16" />
            </div>

            {/* Claim button (conditional) */}
            <Skeleton shimmer className="h-8 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
