import { Skeleton } from '@/seed/components/ui/skeleton';

/** Skeleton matching CreativeStudioPage layout: header + tab bar + content area */
export default function CreativeStudioLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page header */}
      <div className="space-y-2">
        <Skeleton shimmer className="h-8 w-56" />
        <Skeleton shimmer className="h-4 w-80" />
      </div>

      {/* Tab bar: 5 tab buttons */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton shimmer key={i} className="h-10 flex-1 min-w-[120px] rounded-sm" />
        ))}
      </div>

      {/* Tab content area */}
      <Skeleton shimmer className="h-64 w-full rounded-lg" />
    </div>
  );
}
