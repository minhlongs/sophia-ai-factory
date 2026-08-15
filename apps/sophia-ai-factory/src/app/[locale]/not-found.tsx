import { Link } from '@/navigation';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft, Home } from 'lucide-react';

export default async function NotFound() {
  const t = await getTranslations('notFoundPage');
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] p-6 text-center space-y-8">
      <div className="relative">
        <h1 className="text-6xl sm:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)] motion-safe:animate-pulse">
          404
        </h1>
        <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center pointer-events-none opacity-50 blur-xl">
          <span className="text-6xl sm:text-9xl font-black text-[var(--neon-pink)]">
            404
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
          {t('heading')}
        </h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          {t('description')}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-6 py-3 text-sm font-semibold hover:opacity-90 transition-all"
        >
          <Home className="w-4 h-4" />
          {t('returnHome')}
        </Link>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-6 py-3 text-sm font-semibold text-foreground hover:bg-card transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('goToDashboard')}
        </Link>
      </div>

      <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground pt-4 border-t border-border">
        <Link href="/#features" className="hover:text-[var(--neon-cyan)]">
          {t('features')}
        </Link>
        <Link href="/pricing" className="hover:text-[var(--neon-cyan)]">
          {t('pricing')}
        </Link>
        <Link href="/dashboard" className="hover:text-[var(--neon-cyan)]">
          {t('dashboard')}
        </Link>
        <a href="mailto:support@mekongmind.com" className="hover:text-[var(--neon-cyan)]">
          {t('contactSupport')}
        </a>
      </div>
    </div>
  );
}
