import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <Skeleton className="h-10 w-[200px] bg-white/5" />
        <Skeleton className="h-10 w-[120px] bg-white/5" />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-[120px] rounded-xl bg-white/5" />
        <Skeleton className="h-[120px] rounded-xl bg-white/5" />
        <Skeleton className="h-[120px] rounded-xl bg-white/5" />
        <Skeleton className="h-[120px] rounded-xl bg-white/5" />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Skeleton className="col-span-4 h-[400px] rounded-xl bg-white/5" />
        <Skeleton className="col-span-3 h-[400px] rounded-xl bg-white/5" />
      </div>
    </div>
  );
}
