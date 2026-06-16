import { Skeleton } from "@/seed/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton shimmer className="h-10 w-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton shimmer className="h-6 w-40" />
            <Skeleton shimmer className="h-4 w-56" />
          </div>
        </div>
        <Skeleton shimmer className="h-10 w-28 rounded-lg" />
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="rounded-xl bg-white/5 border border-white/10 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Skeleton shimmer className="h-4 w-4" />
              <Skeleton shimmer className="h-3 w-16" />
            </div>
            <Skeleton shimmer className="h-6 w-20" />
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-white/10">
          <Skeleton shimmer className="h-4 w-4" />
          <Skeleton shimmer className="h-4 w-32" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {['Name', 'Category', 'Status', 'Sales', 'Revenue'].map(h => (
                  <th key={h} className="px-4 py-3 text-left">
                    <Skeleton shimmer className="h-3 w-16" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {[1, 2, 3, 4, 5].map(i => (
                <tr key={i} className="hover:bg-white/5">
                  <td className="px-5 py-3">
                    <div className="space-y-1">
                      <Skeleton shimmer className="h-4 w-32" />
                      <Skeleton shimmer className="h-3 w-24" />
                    </div>
                  </td>
                  <td className="px-4 py-3"><Skeleton shimmer className="h-3 w-12" /></td>
                  <td className="px-4 py-3"><Skeleton shimmer className="h-4 w-16 rounded-full" /></td>
                  <td className="px-4 py-3 text-right"><Skeleton shimmer className="h-4 w-8 ml-auto" /></td>
                  <td className="px-4 py-3 text-right"><Skeleton shimmer className="h-4 w-16 ml-auto" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
