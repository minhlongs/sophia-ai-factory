export default function AgiHubLoading() {
  return (
    <div className="space-y-8">
      <div className="h-10 w-64 rounded-lg bg-muted animate-pulse" />
      <div className="h-5 w-96 rounded bg-muted animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    </div>
  );
}
