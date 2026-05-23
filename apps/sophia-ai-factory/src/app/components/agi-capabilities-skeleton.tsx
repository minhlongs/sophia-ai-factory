import { Skeleton } from "@/seed/components/ui/skeleton";

export default function AgiCapabilitiesSkeleton() {
  return (
    <section className="py-20 md:py-32 bg-gradient-to-b from-slate-950 to-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header skeleton */}
        <div className="flex flex-col items-center mb-16 gap-4">
          <Skeleton shimmer className="h-7 w-52 rounded-full" />
          <Skeleton shimmer className="h-10 w-80" />
          <Skeleton shimmer className="h-5 w-96" />
        </div>

        {/* Cards skeleton — 6 placeholders */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-3"
            >
              <Skeleton shimmer className="h-12 w-12 rounded-lg" />
              <Skeleton shimmer className="h-5 w-3/4" />
              <Skeleton shimmer className="h-4 w-full" />
              <Skeleton shimmer className="h-4 w-5/6" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
