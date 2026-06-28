export default function Loading() {
  return (
    <div className="space-y-6 motion-safe:animate-pulse">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 bg-muted rounded w-40" />
          <div className="h-4 bg-muted rounded w-72" />
        </div>
        <div className="h-10 bg-muted rounded-lg w-24" />
      </div>
      <div className="h-28 bg-muted rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="h-36 bg-muted rounded-xl" />
        ))}
      </div>
    </div>
  );
}
