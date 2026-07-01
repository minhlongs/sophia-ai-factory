/**
 * Loading skeleton for niche landing pages.
 * Matches the 6-section layout shape with animate-pulse placeholders.
 */

export default function NicheLoading() {
  return (
    <main className="min-h-screen animate-pulse">
      {/* Hero skeleton */}
      <section className="py-28 bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-950">
        <div className="container mx-auto px-4 text-center space-y-6">
          <div className="h-14 bg-gray-200 dark:bg-gray-800 rounded-lg max-w-2xl mx-auto" />
          <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded max-w-xl mx-auto" />
          <div className="h-12 w-40 bg-gray-200 dark:bg-gray-800 rounded-full mx-auto mt-8" />
        </div>
      </section>

      {/* Features skeleton */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded w-64 mx-auto mb-12" />
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 space-y-3">
                <div className="h-8 w-8 bg-gray-200 dark:bg-gray-800 rounded" />
                <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded w-3/4" />
                <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded" />
                <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-5/6" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works skeleton */}
      <section className="py-20 bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded w-64 mx-auto mb-12" />
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[1, 2, 3].map((i) => (
              <div key={i} className="text-center space-y-3">
                <div className="h-12 w-12 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto" />
                <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded w-1/2 mx-auto" />
                <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded mx-auto" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
