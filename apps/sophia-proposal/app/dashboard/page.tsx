"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && !isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isClient, isLoading, isAuthenticated, router]);

  if (!isClient || isLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="bg-white border-b border-surface-container-highest">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-sm">smart_toy</span>
              </div>
              <h1 className="text-lg font-semibold text-gray-900">Sophia AI Factory</h1>
            </div>
            <div className="flex items-center space-x-4">
              <a href="/missions" className="text-sm font-medium text-orange-600 hover:text-orange-700">Missions</a>
              <a href="/pricing" className="text-sm text-gray-600 hover:text-gray-900">Pricing</a>
              <span className="text-sm text-gray-600">{user.email}</span>
              <button className="text-sm text-primary hover:text-primary-hover font-medium">
                Settings
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-primary to-primary-container rounded-2xl p-8 mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">
            Welcome to Sophia AI Factory
          </h2>
          <p className="text-white/80">
            Start building your AI applications in minutes
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <a
            href="/dashboard/api-keys"
            className="bg-white rounded-xl p-6 shadow-sm border border-orange-200 hover:shadow-md hover:border-orange-400 transition-all"
          >
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-orange-500 text-2xl">key</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">API Keys</h3>
            <p className="text-sm text-gray-600">Manage your <code className="text-xs bg-orange-50 px-1 rounded">sk_live_*</code> keys</p>
          </a>

          <a
            href="/dashboard/missions"
            className="bg-white rounded-xl p-6 shadow-sm border border-orange-200 hover:shadow-md hover:border-orange-400 transition-all"
          >
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-orange-500 text-2xl">rocket_launch</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Missions</h3>
            <p className="text-sm text-gray-600">Run AI-powered tasks via RaaS API</p>
          </a>

          <a
            href="/dashboard/usage"
            className="bg-white rounded-xl p-6 shadow-sm border border-orange-200 hover:shadow-md hover:border-orange-400 transition-all"
          >
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-orange-500 text-2xl">analytics</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Usage</h3>
            <p className="text-sm text-gray-600">Track MCU credits and API calls</p>
          </a>

          <a
            href="/docs/api"
            className="bg-white rounded-xl p-6 shadow-sm border border-orange-200 hover:shadow-md hover:border-orange-400 transition-all"
          >
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-orange-500 text-2xl">menu_book</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">API Docs</h3>
            <p className="text-sm text-gray-600">Explore endpoints and examples</p>
          </a>
        </div>

        {/* Getting Started */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-orange-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Getting Started with RaaS</h3>
          <div className="space-y-6">
            {/* Step 1 */}
            <div className="flex items-start space-x-4">
              <div className="w-7 h-7 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0">
                1
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Get your API key</p>
                <p className="text-sm text-gray-600 mt-1">
                  Go to <a href="/dashboard/api-keys" className="text-orange-600 hover:underline font-medium">API Keys</a>, create a new key. Copy the <code className="text-xs bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded">sk_live_*</code> value — you will need it for every request.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start space-x-4">
              <div className="w-7 h-7 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0">
                2
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">Run your first mission</p>
                <p className="text-sm text-gray-600 mt-1 mb-2">POST to the missions endpoint with your command and params:</p>
                <pre className="bg-gray-900 text-green-400 text-xs rounded-lg p-4 overflow-x-auto leading-relaxed">
{`curl -X POST https://sophia-ai-factory.agencyos-openclaw.workers.dev/api/v1/missions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"command": "proposal:create", "params": {"client_name": "Acme Corp", "service": "AI Automation"}}'`}
                </pre>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start space-x-4">
              <div className="w-7 h-7 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0">
                3
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Check results</p>
                <p className="text-sm text-gray-600 mt-1">
                  Poll <code className="text-xs bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded">GET /api/v1/missions/:id</code> for status, or subscribe to the SSE stream at <code className="text-xs bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded">/api/v1/missions/:id/stream</code> for real-time progress updates.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
