import { Skeleton } from "@/seed/components/ui/skeleton";

export default function ScheduleLoading() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton shimmer className="h-7 w-48" />
          <Skeleton shimmer className="h-4 w-64" />
        </div>
        <Skeleton shimmer className="h-10 w-32 rounded-lg" />
      </div>

      {/* Schedule list skeleton */}
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-card p-6 rounded-xl border border-border flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-4">
              <Skeleton shimmer className="h-5 w-5 rounded mt-1" />
              <div className="space-y-2 flex-1">
                <Skeleton shimmer className="h-5 w-3/4" />
                <div className="flex items-center gap-2">
                  <Skeleton shimmer className="h-4 w-20" />
                  <Skeleton shimmer className="h-4 w-24" />
                </div>
                <Skeleton shimmer className="h-2 w-1/2 rounded-full" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Skeleton shimmer className="h-9 w-20 rounded-lg" />
              <Skeleton shimmer className="h-9 w-9 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
