import { Skeleton } from "@/seed/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton shimmer className="h-7 w-48" />
          <Skeleton shimmer className="h-4 w-64" />
        </div>
        <Skeleton shimmer className="h-10 w-28 rounded-lg" />
      </div>

      {/* Redirect indicator */}
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <div className="flex items-center gap-3">
          <Skeleton shimmer className="h-4 w-32" />
          <Skeleton shimmer className="h-4 w-24" />
        </div>
      </div>
    </div>
  );
}
