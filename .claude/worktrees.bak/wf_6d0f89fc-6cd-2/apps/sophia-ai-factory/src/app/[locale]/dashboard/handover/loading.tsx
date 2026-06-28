import { Skeleton } from "@/seed/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton shimmer className="h-10 w-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton shimmer className="h-6 w-40" />
            <Skeleton shimmer className="h-4 w-56" />
          </div>
        </div>
        <Skeleton shimmer className="h-10 w-28 rounded-lg" />
      </div>

      {/* Handover status cards/steps */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton shimmer className="h-8 w-8 rounded-full" />
              <Skeleton shimmer className="h-4 w-24" />
            </div>
            <Skeleton shimmer className="h-3 w-full" />
            <Skeleton shimmer className="h-3 w-3/4" />
            <div className="pt-2 border-t border-border">
              <Skeleton shimmer className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>

      {/* Detailed progress section */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <Skeleton shimmer className="h-5 w-48" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton shimmer className="h-6 w-6 rounded" />
                <div className="space-y-1">
                  <Skeleton shimmer className="h-4 w-32" />
                  <Skeleton shimmer className="h-3 w-24" />
                </div>
              </div>
              <Skeleton shimmer className="h-4 w-12" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
