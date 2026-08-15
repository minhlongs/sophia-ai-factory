/**
 * Root not-found boundary. Renders outside NextIntlClientProvider, so text is
 * hardcoded bilingual and links are plain anchors rather than locale-aware ones.
 * Reached only for paths the middleware never rewrites into a locale segment.
 */
export default function RootNotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center max-w-md space-y-6">
        <h1 className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)]">
          404
        </h1>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">
            Không tìm thấy trang / Page not found
          </h2>
          <p className="text-sm text-muted-foreground">
            Trang bạn tìm không tồn tại hoặc đã được chuyển đi.
            <br />
            The page you are looking for does not exist or has been moved.
          </p>
        </div>
        <a
          href="/vi"
          className="inline-block rounded-lg bg-primary text-primary-foreground px-6 py-3 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Về trang chủ / Back to home
        </a>
      </div>
    </main>
  );
}
