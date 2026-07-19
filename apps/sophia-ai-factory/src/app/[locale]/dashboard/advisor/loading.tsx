import { Skeleton } from "@/seed/components/ui/skeleton";

export default function AdvisorLoading() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton shimmer className="h-7 w-56" />
        <Skeleton shimmer className="h-4 w-80" />
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} shimmer className="h-28 rounded-xl" />
        ))}
      </div>

      {/* Main chart area */}
      <Skeleton shimmer className="h-[380px] rounded-xl" />

      {/* Secondary content */}
      <Skeleton shimmer className="h-64 rounded-xl" />
    </div>
  );
}
