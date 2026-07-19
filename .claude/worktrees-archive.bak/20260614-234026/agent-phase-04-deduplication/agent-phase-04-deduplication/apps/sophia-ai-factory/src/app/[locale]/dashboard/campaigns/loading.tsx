import { Skeleton } from "@/seed/components/ui/skeleton";

/** Skeleton matching campaigns list page: header + campaign card rows */
export default function Loading() {
  return (
    <div className="space-y-8">
      {/* Header: title + new campaign button */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton shimmer className="h-7 w-40" />
          <Skeleton shimmer className="h-4 w-56" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton shimmer className="h-10 w-28 rounded-lg" />
          <Skeleton shimmer className="h-10 w-36 rounded-lg" />
        </div>
      </div>

      {/* Campaign card skeletons matching CampaignItem + CampaignActions */}
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map(i => (
          <div
            key={i}
            className="bg-card p-6 rounded-xl border border-border flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-4">
              {/* Status icon */}
              <Skeleton shimmer className="h-8 w-8 rounded-full mt-1" />
              <div className="space-y-2">
                {/* Campaign title */}
                <Skeleton shimmer className="h-5 w-52" />
                {/* Date + audience */}
                <div className="flex items-center gap-2">
                  <Skeleton shimmer className="h-3.5 w-20" />
                  <Skeleton shimmer className="h-3.5 w-2 rounded-full" />
                  <Skeleton shimmer className="h-3.5 w-28" />
                </div>
                {/* Progress bar */}
                <Skeleton shimmer className="h-2 w-[200px] rounded-full" />
              </div>
            </div>
            {/* Action buttons */}
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
