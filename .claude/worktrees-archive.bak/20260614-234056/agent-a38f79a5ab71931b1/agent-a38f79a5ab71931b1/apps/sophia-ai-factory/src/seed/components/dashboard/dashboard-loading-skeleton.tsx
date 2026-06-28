import { Skeleton } from '@/seed/components/ui/skeleton';

type SkeletonVariant = 'list' | 'detail' | 'dashboard-home';

function ListSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton shimmer className="h-7 w-48" />
          <Skeleton shimmer className="h-4 w-64" />
        </div>
        <Skeleton shimmer className="h-10 w-32 rounded-lg" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="bg-card p-4 rounded-xl border border-border flex items-center gap-4">
            <Skeleton shimmer className="h-10 w-10 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton shimmer className="h-5 w-48" />
              <Skeleton shimmer className="h-3.5 w-32" />
            </div>
            <Skeleton shimmer className="h-8 w-20 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton shimmer className="h-7 w-56" />
        <Skeleton shimmer className="h-4 w-80" />
      </div>
      <div className="bg-card p-6 rounded-xl border border-border space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="space-y-1">
            <Skeleton shimmer className="h-4 w-24" />
            <Skeleton shimmer className="h-10 w-full rounded-lg" />
          </div>
        ))}
        <Skeleton shimmer className="h-10 w-32 rounded-lg mt-2" />
      </div>
    </div>
  );
}

function DashboardHomeSkeleton() {
  return (
    <div className="space-y-8">
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
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-card p-5 rounded-xl border border-border flex items-center gap-4">
            <Skeleton shimmer className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton shimmer className="h-5 w-48" />
              <Skeleton shimmer className="h-3.5 w-32" />
            </div>
            <Skeleton shimmer className="h-8 w-20 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardSkeleton({ variant = 'list' }: { variant?: SkeletonVariant }) {
  if (variant === 'detail') return <DetailSkeleton />;
  if (variant === 'dashboard-home') return <DashboardHomeSkeleton />;
  return <ListSkeleton />;
}
