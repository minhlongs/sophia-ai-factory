import { Link } from '@/navigation';

/**
 * 404 page for niche landing pages.
 * Shown when neither D1 nor LLM fallback can produce content for the niche slug.
 */

export default function NicheNotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950">
      <div className="text-center px-4 max-w-md">
        <h1 className="text-6xl font-bold text-gray-300 dark:text-gray-700 mb-4">404</h1>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Page Not Found / Không Tìm Thấy Trang
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          We could not find content for this niche. It may not be available yet.
          <br />
          <span className="text-sm">
            Không tìm thấy nội dung cho lĩnh vực này. Có thể nó chưa có sẵn.
          </span>
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-primary/10 hover:bg-primary/10 text-white px-6 py-3 rounded-full font-semibold transition-colors"
        >
          Back to Home / Về Trang Chủ
        </Link>
      </div>
    </main>
  );
}
