/**
 * Missions Loading State
 */
export default function MissionsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 bg-muted rounded w-40" />
          <div className="h-4 bg-muted rounded w-64" />
        </div>
        <div className="h-9 bg-muted rounded w-32" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="h-24 bg-muted rounded-xl" />
        <div className="md:col-span-2 h-24 bg-muted rounded-xl" />
      </div>
      <div className="h-64 bg-muted rounded-xl" />
    </div>
  );
}
