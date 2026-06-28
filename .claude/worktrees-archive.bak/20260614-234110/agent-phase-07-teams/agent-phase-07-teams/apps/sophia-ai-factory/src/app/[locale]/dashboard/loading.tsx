import { Skeleton } from "@/seed/components/ui/skeleton";

/** Skeleton matching DashboardStats (3 stat cards) + CampaignList (campaign rows) */
export default function Loading() {
  return (
    <div className="space-y-8">
      {/* Header: title + buttons */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton shimmer className="h-7 w-48" />
          <Skeleton shimmer className="h-4 w-64" />
        </div>
        <div className="flex gap-3">
          <Skeleton shimmer className="h-10 w-28 rounded-lg" />
          <Skeleton shimmer className="h-10 w-36 rounded-lg" />
        </div>
      </div>

      {/* Stats Grid: 3 stat cards matching DashboardStats layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-card p-6 rounded-xl border border-border">
            <div className="flex items-center justify-between">
              <div className="space-y-3">
                <Skeleton shimmer className="h-4 w-28" />
                <Skeleton shimmer className="h-8 w-16" />
              </div>
              <Skeleton shimmer className="h-12 w-12 rounded-lg" />
            </div>
          </div>
        ))}
      </div>

      {/* Campaign List: card rows matching CampaignItem layout */}
      <div className="space-y-4">
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="bg-card p-6 rounded-xl border border-border flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-4">
              <Skeleton shimmer className="h-8 w-8 rounded-full mt-1" />
              <div className="space-y-2">
                <Skeleton shimmer className="h-5 w-48" />
                <div className="flex items-center gap-2">
                  <Skeleton shimmer className="h-3.5 w-20" />
                  <Skeleton shimmer className="h-3.5 w-24" />
                </div>
                <Skeleton shimmer className="h-2 w-[200px] rounded-full" />
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
