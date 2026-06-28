import { Skeleton } from "@/seed/components/ui/skeleton";

export default function HelpSopsLoading() {
  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="space-y-3">
        <Skeleton shimmer className="h-8 w-3/4 max-w-2xl" />
        <Skeleton shimmer className="h-4 w-full max-w-3xl" />
        <Skeleton shimmer className="h-4 w-2/3 max-w-2xl" />
      </div>

      {/* Sections skeleton */}
      {[1, 2, 3, 4].map((section) => (
        <div key={section} className="space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton shimmer className="h-6 w-6 rounded" />
            <Skeleton shimmer className="h-6 w-48" />
          </div>
          <Skeleton shimmer className="h-4 w-full" />
          <Skeleton shimmer className="h-4 w-5/6" />
          <div className="space-y-2 ml-8">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex gap-2">
                <Skeleton shimmer className="h-4 w-4 rounded-full mt-1" />
                <div className="space-y-1 flex-1">
                  <Skeleton shimmer className="h-4 w-3/4" />
                  <Skeleton shimmer className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
