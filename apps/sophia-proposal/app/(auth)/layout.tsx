import Link from 'next/link';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-surface via-surface-container-low to-primary-container flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg">
            <span className="material-symbols-outlined text-white text-3xl">smart_toy</span>
          </div>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">Sophia AI Factory</h1>
          <p className="text-sm text-gray-600 mt-1">
            Build, deploy, and scale AI applications
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-surface-container-highest">
          {children}
        </div>
        <p className="text-center text-xs text-gray-500 mt-6">
          By continuing, you agree to our{" "}
          <Link href="/terms" className="text-primary hover:underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-primary hover:underline">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}
