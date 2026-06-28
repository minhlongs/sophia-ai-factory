import { Skeleton } from "@/seed/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
      {/* Header */}
      <div className="mb-6">
        <Skeleton shimmer className="h-8 w-48 mb-2" />
        <Skeleton shimmer className="h-4 w-64" />
      </div>

      {/* Tab switcher */}
      <div className="flex gap-4 border-b border-border">
        <Skeleton shimmer className="h-10 w-24 rounded-t-lg border-b-2 border-primary" />
        <Skeleton shimmer className="h-10 w-24 rounded-t-lg" />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-muted px-6 py-4">
          <div className="flex items-center gap-2">
            <Skeleton shimmer className="h-4 w-4" />
            <Skeleton shimmer className="h-4 w-32" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b border-border">
                {['Rank', 'Creator', 'Sales', 'Revenue'].map(h => (
                  <th key={h} className="px-6 py-3 text-left font-medium">
                    <Skeleton shimmer className="h-3 w-12" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
                <tr key={i}>
                  <td className="px-6 py-4"><Skeleton shimmer className="h-4 w-6" /></td>
                  <td className="py-4">
                    <div className="flex items-center gap-3">
                      <Skeleton shimmer className="h-8 w-8 rounded-full" />
                      <div className="space-y-1">
                        <Skeleton shimmer className="h-4 w-32" />
                        <Skeleton shimmer className="h-3 w-20" />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4"><Skeleton shimmer className="h-4 w-8" /></td>
                  <td className="px-6 py-4"><Skeleton shimmer className="h-4 w-16" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
