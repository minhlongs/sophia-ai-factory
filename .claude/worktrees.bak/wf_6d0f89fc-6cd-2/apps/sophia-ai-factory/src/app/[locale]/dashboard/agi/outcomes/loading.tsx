import React from "react";
import { Skeleton } from "@/seed/components/ui/skeleton";

export default function OutcomesLoading() {
  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-[380px] rounded-xl" />
        <Skeleton className="h-[380px] rounded-xl" />
      </div>

      {/* Table */}
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
