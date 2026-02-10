import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton matching campaign detail page: back link, header, video preview, script, sidebar */
export default function Loading() {
  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Back link */}
      <Skeleton shimmer className="h-4 w-32" />

      {/* Header: title + status badge + meta */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton shimmer className="h-8 w-64" />
              <Skeleton shimmer className="h-6 w-24 rounded-full" />
            </div>
            <div className="flex items-center gap-4">
              <Skeleton shimmer className="h-4 w-36" />
              <Skeleton shimmer className="h-4 w-28" />
            </div>
          </div>
          <Skeleton shimmer className="h-10 w-24 rounded-lg" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Video Preview placeholder */}
          <div className="bg-card rounded-xl border border-border p-1">
            <Skeleton shimmer className="w-full aspect-video rounded-lg" />
          </div>

          {/* Script Content placeholder */}
          <div className="bg-card rounded-xl border border-border p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Skeleton shimmer className="h-5 w-5 rounded" />
              <Skeleton shimmer className="h-5 w-20" />
            </div>
            <div className="bg-muted/50 p-4 rounded-lg space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="border-l-2 border-muted pl-4 space-y-2">
                  <Skeleton shimmer className="h-3 w-16" />
                  <Skeleton shimmer className="h-4 w-full" />
                  <Skeleton shimmer className="h-4 w-3/4" />
                  <Skeleton shimmer className="h-3 w-2/3" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Campaign Details card */}
          <div className="bg-card rounded-xl border border-border p-6 space-y-4">
            <Skeleton shimmer className="h-4 w-32" />
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="space-y-1.5">
                  <Skeleton shimmer className="h-3 w-16" />
                  <Skeleton shimmer className="h-4 w-full" />
                </div>
              ))}
              <div className="pt-4 border-t border-border space-y-2">
                <div className="flex justify-between">
                  <Skeleton shimmer className="h-4 w-14" />
                  <Skeleton shimmer className="h-4 w-20" />
                </div>
                <Skeleton shimmer className="h-1.5 w-full rounded-full" />
              </div>
            </div>
          </div>

          {/* System Info card */}
          <div className="bg-muted/50 rounded-xl border border-border p-4 space-y-3">
            <Skeleton shimmer className="h-3 w-24" />
            <div className="space-y-2">
              <div className="flex justify-between">
                <Skeleton shimmer className="h-3 w-8" />
                <Skeleton shimmer className="h-3 w-20" />
              </div>
              <div className="flex justify-between">
                <Skeleton shimmer className="h-3 w-16" />
                <Skeleton shimmer className="h-3 w-28" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
