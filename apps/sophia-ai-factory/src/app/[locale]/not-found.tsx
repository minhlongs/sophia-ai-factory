import Link from "next/link";
import { Button } from "@/seed/components/ui/button";
import { ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] p-6 text-center space-y-8">
      {/* 404 Glitch Effect */}
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

      <div className="space-y-4 max-w-md mx-auto">
        <h2 className="text-3xl font-bold text-white">
          Lost in the Digital Void?
        </h2>
        <p className="text-gray-400 text-lg">
          The page you are looking for has been moved, deleted, or possibly
          never existed in this dimension.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md justify-center">
        <Link href="/">
          <Button
            size="lg"
            className="w-full sm:w-auto gap-2 bg-[var(--neon-purple)] hover:bg-[var(--neon-purple)]/80"
          >
            <Home className="w-4 h-4" />
            Return Home
          </Button>
        </Link>
        <Link href="/dashboard">
          <Button
            variant="outline"
            size="lg"
            className="w-full sm:w-auto gap-2 border-white/20 hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4" />
            Go to Dashboard
          </Button>
        </Link>
      </div>

      {/* Helpful Links */}
      <div className="pt-12 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-500 w-full max-w-2xl border-t border-white/10 mt-8">
        <Link href="/#features" className="hover:text-[var(--neon-cyan)]">
          Features
        </Link>
        <Link href="/pricing" className="hover:text-[var(--neon-cyan)]">
          Pricing
        </Link>
        <Link href="/dashboard" className="hover:text-[var(--neon-cyan)]">
          Dashboard
        </Link>
        <a href="mailto:support@sophia.agencyos.network" className="hover:text-[var(--neon-cyan)]">
          Contact Support
        </a>
      </div>
    </div>
  );
}
