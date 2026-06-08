/**
 * SOP detail loading skeleton
 */

export default function SopDetailLoading() {
  return (
    <div className="space-y-6 motion-safe:animate-pulse max-w-4xl">
      <div className="h-5 w-24 bg-muted-800 rounded" />
      <div className="h-8 w-64 bg-muted-800 rounded" />
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-9 w-24 bg-muted-800 rounded" />
        ))}
      </div>
      <div className="h-48 bg-muted-800 rounded-xl" />
    </div>
  );
}
